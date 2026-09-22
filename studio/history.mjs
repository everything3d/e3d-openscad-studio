import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

const exec = promisify(execFile)
const exclusions = ['.renders', '.feedback', '.agents', '.codex', '.git', 'node_modules', '.env*', '**/.env*']
const pathspec = ['.', ...exclusions.map(name => `:(exclude)${name}`)]
export async function atomicJSON(filename, value) {
  const temporary = `${filename}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2))
  await rename(temporary, filename)
}

/** Standard Git snapshots. Application history is separate from Codex's conversation. */
export class WorkspaceHistory {
  constructor(workspace, directory) {
    this.workspace = workspace; this.directory = directory
    this.repository = path.join(directory, 'repository.git')
    this.filename = path.join(directory, 'history.json')
  }
  async git(...args) {
    const { stdout } = await exec('git', ['--git-dir=' + this.repository, '--work-tree=' + this.workspace,
      '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
      '-c', 'user.name=E3D Studio', '-c', 'user.email=studio@localhost', ...args],
    { cwd: this.workspace, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, maxBuffer: 16 * 1024 * 1024 })
    return stdout.trim()
  }
  async initialize() {
    await mkdir(this.directory, { recursive: true })
    await mkdir(this.workspace, { recursive: true })
    try { this.state = JSON.parse(await readFile(this.filename, 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await exec('git', ['init', '--bare', this.repository])
      this.state = { entries: [], cursor: -1, pending: null, restore: null, generation: 0 }
      await this.checkpoint('Initial design')
    }
    // Finish a journaled restore before accepting any new work.
    if (this.state.restore) await this.finishRestore()
    if (this.state.pending) await this.complete('interrupted', 'Recovered an interrupted request')
    else await this.checkpoint('Recovered file changes')
    return this
  }
  async save() { await atomicJSON(this.filename, this.state) }
  async tree() {
    await this.git('add', '-A', '-f', '--', ...pathspec)
    return this.git('write-tree')
  }
  async checkpoint(label, extra = {}) {
    const tree = await this.tree()
    const previous = this.state.entries[this.state.cursor]
    if (previous?.tree === tree) return null
    const commit = await this.git('commit-tree', tree, ...(previous ? ['-p', previous.commit] : []), '-m', label.slice(0, 500))
    // Keep all immutable snapshots reachable even when a new edit replaces the redo path.
    await this.git('update-ref', `refs/e3d/${commit}`, commit)
    const entry = { commit, tree, label, createdAt: Date.now(), ...extra }
    this.state.entries = [...this.state.entries.slice(0, this.state.cursor + 1), entry]
    this.state.cursor = this.state.entries.length - 1
    await this.save()
    return entry
  }
  async begin(request) {
    if (this.state.pending) throw new Error('A design change is already in progress')
    await this.checkpoint('External file changes')
    this.state.pending = { ...request, before: this.current.commit, startedAt: Date.now() }
    await this.save()
  }
  async complete(status, label) {
    const request = this.state.pending
    if (!request) return null
    const entry = await this.checkpoint(label || request.text, { requestId: request.id, status, before: request.before, beforeRender: request.beforeRender })
    this.state.pending = null
    await this.save()
    return entry
  }
  get current() { return this.state.entries[this.state.cursor] }
  async move(direction) {
    if (this.state.pending) throw new Error('Stop the current change before using history')
    await this.checkpoint('External file changes')
    const target = this.state.cursor + (direction === 'undo' ? -1 : 1)
    if (target < 0 || target >= this.state.entries.length) throw new Error(`Nothing to ${direction}`)
    this.state.restore = { target }
    await this.save()
    await this.finishRestore()
    return this.current
  }
  async finishRestore() {
    const { target } = this.state.restore
    // read-tree updates the index and tracked worktree, including added/deleted binary assets.
    await this.git('read-tree', '--reset', '-u', this.state.entries[target].commit)
    this.state.cursor = target
    this.state.generation++
    this.state.restore = null
    await this.save()
  }
  async archive() {
    const { stdout } = await exec('git', ['--git-dir=' + this.repository, 'archive', '--format=zip', this.current.commit],
      { encoding: 'buffer', maxBuffer: 80 * 1024 * 1024,
        env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } })
    return stdout
  }
  summary() {
    return { entries: this.state.entries, cursor: this.state.cursor, current: this.current.commit,
      generation: this.state.generation, pending: this.state.pending,
      canUndo: this.state.cursor > 0 && !this.state.pending,
      canRedo: this.state.cursor < this.state.entries.length - 1 && !this.state.pending }
  }
}
