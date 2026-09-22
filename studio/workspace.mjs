import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { WorkspaceHistory, atomicJSON } from './history.mjs'
import { runtimeOptions, connectRuntime } from './runtime.mjs'
import { buildWorkspace } from './build.mjs'
import { fingerprint, workspaceFiles } from '../prototype/render.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const seed = '$fn=64;\ncolor("#397c9a") linear_extrude(3) offset(r=3) square([84,26],center=true);\ncolor("#fff4d6") translate([0,0,3]) linear_extrude(1) text("Hello",size=15,font="Liberation Sans:style=Bold",halign="center",valign="center");\n'
const skillPath = path.join(repo, 'prototype/skills/openscad-studio/SKILL.md')
const readJSON = async (filename, fallback) => { try { return JSON.parse(await readFile(filename, 'utf8')) } catch (e) { if(e.code !== 'ENOENT') throw e; return fallback } }

export class DesignWorkspace {
  constructor(directory, env = process.env) {
    this.directory = directory; this.env = env; this.files = path.join(directory, 'files')
    this.listeners = new Set(); this.activeTurn = null; this.busy = false; this.lastError = null
    this.queue = Promise.resolve()
  }
  async initialize(initial = {}) {
    await mkdir(this.files, { recursive: true })
    this.meta = await readJSON(path.join(this.directory, 'project.json'), null)
    if (!this.meta) {
      this.meta = { id: path.basename(this.directory), name: initial.name || 'Untitled design', createdAt: Date.now(), updatedAt: Date.now() }
      await writeFile(path.join(this.files, 'input.scad'), initial.code ?? seed)
      for (const file of initial.files ?? []) await this.writeAsset(file)
      await atomicJSON(path.join(this.directory, 'project.json'), this.meta)
    }
    await mkdir(path.join(this.files, '.agents/skills/openscad-studio'), { recursive: true })
    await cp(skillPath, path.join(this.files, '.agents/skills/openscad-studio/SKILL.md'))
    this.history = await new WorkspaceHistory(this.files, path.join(this.directory, 'history')).initialize()
    this.requests = await readJSON(path.join(this.directory, 'requests.json'), [])
    for (const request of this.requests) if (request.status === 'working') request.status = 'interrupted'
    await this.saveRequests()
    if (!await this.manifest()) { try { await buildWorkspace(this.files) } catch {} }
    return this
  }
  exclusive(fn) {
    const promise = this.queue.then(fn)
    this.queue = promise.catch(() => {})
    return promise
  }
  emit(message) { for (const listener of this.listeners) listener(message) }
  async saveRequests() { await atomicJSON(path.join(this.directory, 'requests.json'), this.requests) }
  async manifest() { return readJSON(path.join(this.files, '.renders/latest.json'), null) }
  async state() {
    const render = await this.manifest()
    if (render) render.stale = render.sourceHash !== fingerprint(await workspaceFiles(this.files))
    return { project: this.meta, busy: this.busy, operation: this.operation, activeTurn: this.activeTurn, render,
      history: this.history.summary(), requests: this.requests,
      runtime: { provider: 'OpenRouter', model: this.env.STUDIO_MODEL || 'openai/gpt-6-astra', configured: Boolean(this.env.OPENROUTER_API_KEY) },
      error: this.lastError }
  }
  async runtime() {
    if (this.connection && this.connectionReady && !this.connection.closed) return this.connection
    this.options = await runtimeOptions(path.join(this.directory, 'agent'), this.env)
    if (!this.options.hasKey) throw new Error('Set OPENROUTER_API_KEY in .env.local and restart Studio to enable the design assistant. Your design and history are available.')
    const connection = connectRuntime(this.options, this.files, message => { if(this.connection===connection)this.onEvent(message) })
    this.connection = connection
    try {
    await connection.initialize()
    const saved = await readJSON(path.join(this.directory, 'session.json'), null)
    const params = { cwd: this.files, model: this.options.model, modelProvider: 'openrouter', config: this.options.config,
      approvalPolicy: 'never', sandbox: 'workspace-write',
      developerInstructions: 'This workspace is a CAD design. Follow the openscad-studio skill. Use ordinary coding and image tools. Keep changes in the design directory. Application history, credentials, and rendering infrastructure are outside the design and must not be modified. The current files are authoritative after any application undo or redo. Do not run git commands to change application history.' }
    const result = saved?.threadId ? await connection.request('thread/resume', { ...params, threadId: saved.threadId }) : await connection.request('thread/start', params)
    this.threadId = result.thread.id
    await atomicJSON(path.join(this.directory, 'session.json'), { threadId: this.threadId, provider: 'openrouter' })
    this.connectionReady = true
    return connection
    } catch(error) { this.connectionReady=false;this.connection=null;connection.close();throw error }
  }
  onEvent(message) {
    const p = message.params ?? {}, request = this.requests.findLast(r => r.status === 'working')
    if (message.method === 'turn/started') this.activeTurn = p.turn.id
    if (message.method === 'error') this.lastError = p.error?.message || 'The model request failed'
    if (request && message.method === 'item/completed') {
      if (p.item.type === 'agentMessage') request.response = p.item.text
      if (p.item.type === 'imageView') request.inspected.push(p.item.path)
    }
    this.emit(message)
    if (message.method === 'turn/completed') this.exclusive(() => this.finish(p.turn.status, p.turn.error?.message)).catch(e => this.fail(e))
    if (message.method === 'connection/error') this.exclusive(() => this.finish('interrupted', p.message)).catch(e => this.fail(e))
  }
  fail(error) { this.lastError = error.message; this.busy = false; this.operation=null; this.emit({ method: 'studio/error', params: { message: error.message } }) }
  async start(payload) {
    if (this.busy) throw new Error('A change is already running')
    this.busy = true; this.operation='model'; this.cancelRequested=false
    return this.exclusive(async () => {
      try {
        if (typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 30000) throw new Error('Enter a request up to 30,000 characters')
        if (!Array.isArray(payload.images ?? []) || (payload.images?.length ?? 0) > 3) throw new Error('Attach up to three images')
        const connection = await this.runtime()
        if(this.cancelRequested) throw new Error('Request stopped before editing began')
        const id = randomUUID(), images = []
        await mkdir(path.join(this.files, '.feedback'), { recursive: true })
        for (const image of payload.images ?? []) {
          const match = image.data?.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/)
          if (!match) throw new Error('Use PNG or JPEG images')
          const bytes = Buffer.from(match[2], 'base64')
          if (bytes.length > 2500000) throw new Error('An image exceeds 2.5 MB')
          const name = `.feedback/${randomUUID()}.${match[1] === 'png' ? 'png' : 'jpg'}`
          await writeFile(path.join(this.files, name), bytes)
          images.push({ path: name, context: image.context })
        }
        const request = { id, text: payload.text.trim(), images, beforeRender: await this.manifest(), status: 'working', createdAt: Date.now(), inspected: [] }
        await this.history.begin(request)
        this.requests.push(request); await this.saveRequests(); this.lastError = null
        const input = [{ type: 'text', text: request.text }, { type: 'skill', name: 'openscad-studio', path: skillPath },
          { type: 'text', text: `Application checkpoint: ${this.history.current.commit}; history generation: ${this.history.state.generation}. Files on disk are authoritative. Earlier messages may describe a design that the user has undone. Inspect current files before editing.` }]
        for (const image of images) {
          input.push({ type: 'localImage', path: path.join(this.files, image.path) })
          if (image.context) input.push({ type: 'text', text: `View metadata (reference only): ${JSON.stringify(image.context).slice(0,8000)}` })
        }
        this.emit({ method: 'studio/request', params: request })
        const result = await connection.request('turn/start', { threadId: this.threadId, input })
        this.activeTurn = result.turn.id
        if(this.cancelRequested) await connection.request('turn/interrupt',{threadId:this.threadId,turnId:this.activeTurn})
        return { requestId: id, turnId: this.activeTurn }
      } catch (error) { await this.finish('failed', error.message); throw error }
    })
  }
  async finish(status, error) {
    const request = this.requests.findLast(r => r.status === 'working')
    if (request) {
      const checkpoint = await this.history.complete(status)
      request.status = status; request.error = error || this.lastError; request.finishedAt = Date.now()
      request.after = checkpoint?.commit || this.history.current.commit
      request.afterRender = await this.manifest()
      await this.saveRequests()
      this.meta.updatedAt = Date.now(); await atomicJSON(path.join(this.directory, 'project.json'), this.meta)
    }
    this.activeTurn = null; this.busy = false; this.operation=null; if (error) this.lastError = error
    this.emit({ method: 'studio/settled', params: { status, error } })
  }
  async stop() {
    this.cancelRequested=true
    if (this.activeTurn && this.connection) await this.connection.request('turn/interrupt', { threadId: this.threadId, turnId: this.activeTurn })
  }
  async move(direction) {
    if (this.busy) throw new Error('Stop the current change before using history')
    this.busy = true; this.operation='history'
    return this.exclusive(async () => {
      try {
        await this.history.move(direction)
        try { await buildWorkspace(this.files); this.lastError=null } catch (e) { this.lastError = e.message }
        this.emit({ method: 'studio/restored', params: { direction } })
        return this.history.summary()
      } finally { this.busy = false; this.operation=null }
    })
  }
  async writeAsset(file) {
    if (typeof file.name !== 'string' || !file.name || file.name.includes('\\') || file.name.split('/').some(p => !p || p === '..' || p.startsWith('.')) || file.name.startsWith('/')) throw new Error('Use a relative asset path without hidden or parent directories')
    const destination = path.join(this.files, file.name)
    // Reject pre-existing symlink parents so imports cannot write outside the workspace.
    const { lstat } = await import('node:fs/promises')
    let parent = this.files
    for (const part of file.name.split('/')) {
      parent = path.join(parent, part)
      try { if ((await lstat(parent)).isSymbolicLink()) throw new Error('Cannot import through a symbolic link') } catch(e) { if(e.code !== 'ENOENT') throw e }
    }
    const data = Buffer.from(file.data, 'base64')
    if (data.length > 32 * 1024 * 1024) throw new Error('An asset exceeds 32 MB')
    await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, data)
  }
  async importFiles(files) {
    if (this.busy) throw new Error('Wait for the current change to finish')
    if(!Array.isArray(files) || files.length>100) throw new Error('Import up to 100 files at once')
    this.busy = true; this.operation='import'
    return this.exclusive(async () => {
      let failure
      try {
        await this.history.begin({ id: randomUUID(), text: 'Imported project files', beforeRender: await this.manifest() })
        for (const file of files) await this.writeAsset(file)
      } catch(error) { failure=error;throw error }
      finally {
        try {
          await this.history.complete(failure?'failed':'completed')
          try { await buildWorkspace(this.files);this.lastError=null } catch (e) { this.lastError = e.message }
        } finally { this.busy = false; this.operation=null }
      }
    })
  }

  close() { this.connection?.close() }
}
