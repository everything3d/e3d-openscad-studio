import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { WorkspaceHistory } from './history.mjs'

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e3d-history-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const workspace = path.join(root, 'workspace'), directory = path.join(root, 'history')
  await mkdir(workspace)
  await writeFile(path.join(workspace, 'input.scad'), 'cube(1);')
  return { root, workspace, directory, history: await new WorkspaceHistory(workspace, directory).initialize() }
}

test('whole-project undo/redo restores binary files and deletions without touching feedback or secrets', async t => {
  const { workspace: w, history: h } = await fixture(t)
  await mkdir(path.join(w, '.feedback'))
  await writeFile(path.join(w, '.feedback/view.png'), 'reference')
  await writeFile(path.join(w, '.env.local'), 'SECRET=local')
  await h.begin({ id: 'one', text: 'Add an asset' })
  await writeFile(path.join(w, 'icon.svg'), Buffer.from([0, 255, 1, 128]))
  await writeFile(path.join(w, 'input.scad'), 'cube(2);')
  await h.complete('completed')
  await h.move('undo')
  assert.equal(await readFile(path.join(w, 'input.scad'), 'utf8'), 'cube(1);')
  await assert.rejects(access(path.join(w, 'icon.svg')))
  assert.equal(await readFile(path.join(w, '.feedback/view.png'), 'utf8'), 'reference')
  assert.equal(await readFile(path.join(w, '.env.local'), 'utf8'), 'SECRET=local')
  await h.move('redo')
  assert.deepEqual(await readFile(path.join(w, 'icon.svg')), Buffer.from([0, 255, 1, 128]))
  await h.begin({ id: 'two', text: 'Delete asset' })
  await rm(path.join(w, 'icon.svg'))
  await h.complete('completed')
  await h.move('undo')
  assert.deepEqual(await readFile(path.join(w, 'icon.svg')), Buffer.from([0, 255, 1, 128]))
})

test('new edits replace redo; rejected/no-op requests preserve redo', async t => {
  const { workspace: w, history: h } = await fixture(t)
  await h.begin({ id: 'one', text: 'Grow' })
  await writeFile(path.join(w, 'input.scad'), 'cube(2);')
  await h.complete('completed'); await h.move('undo')
  await h.begin({ id: 'failed', text: 'Nothing happened' }); await h.complete('failed')
  assert.equal(h.summary().canRedo, true)
  await h.begin({ id: 'two', text: 'Different shape' })
  await writeFile(path.join(w, 'input.scad'), 'sphere(3);')
  await h.complete('completed')
  assert.equal(h.summary().canRedo, false)
  assert.equal(h.summary().entries.length, 2)
})

test('restart captures interrupted edits as one recoverable change and blocks undo while running', async t => {
  const { workspace: w, directory: d, history: h } = await fixture(t)
  await h.begin({ id: 'one', text: 'Grow' })
  await writeFile(path.join(w, 'input.scad'), 'cube(3);')
  await assert.rejects(h.move('undo'), /Stop/)
  const restarted = await new WorkspaceHistory(w, d).initialize()
  assert.equal(restarted.summary().pending, null)
  assert.equal(restarted.current.status, 'interrupted')
  assert.equal(restarted.summary().entries.length, 2)
  await restarted.move('undo')
  assert.equal(await readFile(path.join(w, 'input.scad'), 'utf8'), 'cube(1);')
})
