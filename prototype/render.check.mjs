import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { unzipSync, strFromU8 } from 'fflate'
import { renderProject, workspaceFiles, fingerprint } from './render.mjs'
import { rasterize } from './rasterize.mjs'

test('ordinary SCAD and SVG files produce matching color mesh, images, and export; failed edits invalidate the manifest', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'e3d-render-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(path.join(dir, 'assets'))
  await writeFile(path.join(dir, 'assets/icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="4mm" height="4mm" viewBox="0 0 4 4"><path d="M0 0H4V4H0Z"/></svg>')
  await writeFile(path.join(dir, 'support.scad'), 'module base() { color("blue") cube([20,10,2]); }')
  await writeFile(path.join(dir, 'input.scad'), 'use <support.scad>; base(); color("yellow") translate([8,3,2]) linear_extrude(1) import("assets/icon.svg");')
  const result = await renderProject(dir, 'input.scad', ['top', 'front', 'right', 'iso'])
  assert.deepEqual(result.bounds.size, [20, 10, 3])
  assert.deepEqual(new Set(result.palette), new Set(['#0000ff', '#ffff00']))
  assert.equal(result.sourceHash, fingerprint(await workspaceFiles(dir)), 'derived outputs must not make their own source stale')
  for (const item of result.images) {
    const metadata = await sharp(path.join(dir, item.path)).metadata()
    assert.equal(metadata.width, 900); assert.equal(metadata.height, 680)
  }
  const zip = unzipSync(await readFile(path.join(dir, result.download)))
  const xml = strFromU8(zip['3D/3dmodel.model'])
  assert.match(xml, /#0000FFFF/); assert.match(xml, /#FFFF00FF/)
  assert.equal((xml.match(/<triangle /g) || []).length, result.triangles)
  await writeFile(path.join(dir, 'support.scad'), 'module base() { this is invalid syntax; }')
  assert.notEqual(fingerprint(await workspaceFiles(dir)), result.sourceHash, 'supporting-file changes must invalidate renders')
  await assert.rejects(renderProject(dir), /Parser error/)
  const latest = JSON.parse(await readFile(path.join(dir, '.renders/latest.json'), 'utf8'))
  assert.equal(latest.status, 'error')
  assert.equal(latest.download, undefined, 'a failed build must not advertise the old export')
  assert.ok((await readFile(path.join(dir, result.mesh))).length, 'old immutable artifacts remain available as references')
})

test('inspection images use depth, not triangle order, for overlapping surfaces', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'e3d-image-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const mesh = {
    vertices: new Float32Array([-1,-1,2, 1,-1,2, 0,1,2, -1,-1,0, 1,-1,0, 0,1,0]),
    triangles: new Uint32Array([0,1,2, 3,4,5]),
    faceColors: new Uint8Array([255,0,0, 0,0,255]),
  }
  const filename = path.join(dir, 'depth.png')
  await rasterize(mesh, 'top', filename, 200, 200)
  const { data, info } = await sharp(filename).raw().toBuffer({ resolveWithObject: true })
  const center = (100 * info.width + 100) * info.channels
  assert.ok(data[center] > 200, 'front red surface must be visible')
  assert.equal(data[center + 2], 0, 'rear blue surface must be hidden')
})
