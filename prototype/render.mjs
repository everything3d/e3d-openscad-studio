#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { unzipSync } from 'fflate'
import OpenSCAD from '../src/lib/openscad/vendor/openscad.js'
import { parseOFF } from '../src/lib/openscad/off.ts'
import { meshTo3MF } from '../src/lib/openscad/threemf.ts'
import { rasterize } from './rasterize.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** File IO belongs to the compiler boundary; this is not an agent tool. */
export async function workspaceFiles(directory, prefix = '') {
  const files = []
  for (const entry of (await readdir(path.join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || ['node_modules', '__pycache__'].includes(entry.name)) continue
    const name = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...await workspaceFiles(directory, name))
    else if (entry.isFile()) files.push({ name, data: await readFile(path.join(directory, name)) })
  }
  return files
}

export function fingerprint(files) {
  const hash = createHash('sha256')
  for (const f of files) hash.update(f.name).update('\0').update(String(f.data.length)).update('\0').update(f.data)
  return hash.digest('hex')
}

export function meshInfo(mesh) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.vertices.length; i++) {
    min[i % 3] = Math.min(min[i % 3], mesh.vertices[i])
    max[i % 3] = Math.max(max[i % 3], mesh.vertices[i])
  }
  const palette = new Set()
  if (mesh.faceColors) for (let i = 0; i < mesh.faceColors.length; i += 3) {
    palette.add('#' + Array.from(mesh.faceColors.slice(i, i + 3), x => x.toString(16).padStart(2, '0')).join(''))
  }
  return { bounds: { min, max, size: max.map((v, i) => +(v - min[i]).toFixed(3)) },
    triangles: mesh.triangles.length / 3, palette: [...palette] }
}

async function publish(directory, manifest) {
  await mkdir(path.join(directory, '.renders'), { recursive: true })
  const temp = path.join(directory, '.renders', `latest-${process.pid}.json`)
  await writeFile(temp, JSON.stringify(manifest, null, 2))
  await rename(temp, path.join(directory, '.renders/latest.json'))
}

export async function renderProject(directory, entrypoint = 'input.scad', views = ['top', 'iso']) {
  const start = Date.now(), logs = []
  let sourceHash = null
  try {
    if (!views.length || views.some(view => !['top', 'front', 'right', 'iso'].includes(view))) throw new Error('Views: top, front, right, iso')
    const files = await workspaceFiles(directory)
    if (!files.some(f => f.name === entrypoint)) throw new Error(`Entrypoint not found: ${entrypoint}`)
    if (files.reduce((sum, f) => sum + f.data.length, 0) > 64 * 1024 * 1024) throw new Error('Prototype workspace exceeds 64 MB')
    sourceHash = fingerprint(files)
    const instance = await OpenSCAD({
      noInitialRun: true,
      wasmBinary: await readFile(path.join(repo, 'public/openscad/openscad.wasm')),
      print: line => logs.push(line), printErr: line => logs.push(line),
      preRun: [mod => { mod.ENV.FONTCONFIG_PATH = '/fonts' }],
    })
    instance.FS.mkdir('/fonts')
    const fontFiles = unzipSync(await readFile(path.join(repo, 'public/openscad/fonts.zip')))
    for (const [name, data] of Object.entries(fontFiles)) instance.FS.writeFile(`/fonts/${name}`, data)
    const dirs = new Set(['/fonts'])
    for (const f of files) {
      const parts = f.name.split('/').slice(0, -1)
      let parent = ''
      for (const part of parts) {
        parent += `/${part}`
        if (!dirs.has(parent)) { instance.FS.mkdir(parent); dirs.add(parent) }
      }
      instance.FS.writeFile(`/${f.name}`, f.data)
      if (/\.(ttf|otf)$/i.test(f.name)) instance.FS.writeFile(`/fonts/custom-${createHash('sha256').update(f.name).digest('hex').slice(0, 16)}${path.extname(f.name)}`, f.data)
    }
    const exit = instance.callMain([`/${entrypoint}`, '--backend=manifold', '--export-format=off', '-o', '/__e3d_result.off'])
    if (exit !== 0) throw new Error(`OpenSCAD exited with code ${exit}`)
    // OpenSCAD can exit successfully after an included file fails, leaving partial geometry.
    const compilerError = logs.find(line => /^ERROR:/i.test(line.trim()))
    if (compilerError) throw new Error(compilerError)
    const bytes = instance.FS.readFile('/__e3d_result.off')
    const mesh = parseOFF(bytes)
    if (!mesh.triangles.length) throw new Error('OpenSCAD produced an empty mesh')
    const id = `${sourceHash.slice(0, 12)}-${Date.now()}`
    const relative = `.renders/${id}`
    const destination = path.join(directory, relative)
    await mkdir(destination, { recursive: true })
    await writeFile(path.join(destination, 'model.off'), bytes)
    await writeFile(path.join(destination, 'model.3mf'), meshTo3MF(mesh))
    const info = meshInfo(mesh)
    const images = []
    for (const view of [...new Set(views)]) {
      const filename = path.join(destination, `${view}.png`)
      await rasterize(mesh, view, filename)
      images.push({ view, path: `${relative}/${view}.png` })
    }
    const manifest = { status: 'done', id, sourceHash, entrypoint, createdAt: Date.now(), durationMs: Date.now() - start,
      mesh: `${relative}/model.off`, download: `${relative}/model.3mf`, images, ...info, logs }
    await writeFile(path.join(destination, 'diagnostics.json'), JSON.stringify(manifest, null, 2))
    await publish(directory, manifest)
    return manifest
  } catch (error) {
    const manifest = { status: 'error', sourceHash, createdAt: Date.now(), error: error.message, logs, durationMs: Date.now() - start }
    await publish(directory, manifest)
    throw Object.assign(error, { diagnostics: manifest })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const viewIndex = args.indexOf('--views')
  const views = viewIndex >= 0 ? (args[viewIndex + 1] || '').split(',') : ['top', 'iso']
  try {
    const result = await renderProject(process.cwd(), args[0] && !args[0].startsWith('--') ? args[0] : 'input.scad', views)
    console.log(JSON.stringify({ ...result, images: result.images.map(item => ({ ...item, path: path.resolve(item.path) })) }, null, 2))
  } catch (error) {
    console.error(JSON.stringify(error.diagnostics ?? { error: error.message }, null, 2))
    process.exitCode = 1
  }
}
