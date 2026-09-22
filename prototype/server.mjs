import http from 'node:http'
import { readFile, writeFile, mkdir, realpath, access, symlink } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { stripTypeScriptTypes } from 'node:module'
import { CodexConnection } from './codex.mjs'
import { fingerprint, workspaceFiles, renderProject } from './render.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataRoot = path.resolve(process.env.CAD_DATA_DIR || path.join(os.homedir(), '.e3d-codex-prototype'))
const workspace = path.join(dataRoot, 'workspace')
const port = Number(process.env.CAD_PORT || 4317)
const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`])
const clients = new Set()
let threadId, activeTurn = null, starting = false, connectionError = null, modelName = null
const completedTurns = new Set()
await mkdir(workspace, { recursive: true })
await mkdir(path.join(workspace, '.agents/skills'), { recursive: true })
const skillPath = path.join(here, 'skills/openscad-studio/SKILL.md')
try { await symlink(path.dirname(skillPath), path.join(workspace, '.agents/skills/openscad-studio'), 'dir') } catch (e) { if (e.code !== 'EEXIST') throw e }
try { await access(path.join(workspace, 'input.scad')) } catch {
  await writeFile(path.join(workspace, 'input.scad'), '// Your design lives here. Codex can edit this file and create any supporting assets.\n$fn = 48;\ncolor("#397c9a") linear_extrude(3) offset(r=3) square([84, 26], center=true);\ncolor("#fff4d6") translate([0,0,3]) linear_extrude(1) text("Hello", size=15, font="Liberation Sans:style=Bold", halign="center", valign="center");\n')
}

function emit(message) {
  if (message.method === 'turn/started') activeTurn = message.params.turn.id
  if (message.method === 'turn/completed') { completedTurns.add(message.params.turn.id); activeTurn = null }
  if (message.method === 'connection/error') { connectionError = message.params.message; activeTurn = null }
  for (const client of clients) client.write(`data: ${JSON.stringify(message)}\n\n`)
}

const codex = new CodexConnection({ cwd: workspace, env: {
  ...process.env,
  E3D_CAD_RENDERER: path.join(here, 'render.mjs'),
  E3D_FONT_CATALOG: path.resolve(here, '../src/lib/openscad/fonts.ts'),
}, onEvent: emit })

const ready = (async () => {
  await codex.initialize()
  let saved
  try { saved = JSON.parse(await readFile(path.join(dataRoot, 'session.json'), 'utf8')) } catch {}
  const params = { cwd: workspace, approvalPolicy: 'never', sandbox: 'workspace-write',
    developerInstructions: 'You are working on a CAD design in the current workspace. Use the openscad-studio skill. Use your existing coding and image tools. Keep project changes inside this workspace. The render utility is supplied infrastructure; do not modify it. The UI is a viewer of your files, not an editor of your tool inputs.',
  }
  const result = saved?.threadId
    ? await codex.request('thread/resume', { ...params, threadId: saved.threadId })
    : await codex.request('thread/start', params)
  threadId = result.thread.id
  modelName = result.model
  await writeFile(path.join(dataRoot, 'session.json'), JSON.stringify({ threadId }))
  return { model: result.model }
})()
ready.catch(error => { connectionError = error.message; emit({ method: 'connection/error', params: { message: error.message } }) })

// The initial demonstration is an artifact, not an AI turn. Existing designs are untouched.
try { await access(path.join(workspace, '.renders/latest.json')) } catch {
  await renderProject(workspace)
}

async function snapshot() {
  let render = null
  try {
    render = JSON.parse(await readFile(path.join(workspace, '.renders/latest.json'), 'utf8'))
    render.stale = render.sourceHash !== fingerprint(await workspaceFiles(workspace))
  } catch {}
  return { threadId, activeTurn, starting, connectionError, model: modelName, render, workspace }
}

async function body(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) throw new Error('Request too large (8 MB maximum)')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function serve(res, filename, contentType) {
  const data = await readFile(filename)
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(data)
}

const server = http.createServer(async (req, res) => {
  try {
    if (!['127.0.0.1:' + port, 'localhost:' + port].includes(req.headers.host) ||
        (req.headers.origin && !origins.has(req.headers.origin))) return json(res, 403, { error: 'This prototype only accepts its local frontend.' })
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, await snapshot())
    if (req.method === 'GET' && url.pathname === '/vendor/off.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' })
      return res.end(stripTypeScriptTypes(await readFile(path.resolve(here, '../src/lib/openscad/off.ts'), 'utf8')))
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      clients.add(res)
      const pulse = setInterval(() => res.write(': heartbeat\n\n'), 15_000)
      req.on('close', () => { clients.delete(res); clearInterval(pulse) })
      try {
        const runtime = await ready
        const history = await codex.request('thread/read', { threadId, includeTurns: true })
        res.write(`data: ${JSON.stringify({ method: 'studio/history', params: { ...history, ...runtime } })}\n\n`)
      } catch (error) { res.write(`data: ${JSON.stringify({ method: 'connection/error', params: { message: error.message } })}\n\n`) }
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/turn') {
      if (activeTurn || starting) return json(res, 409, { error: 'A turn is already running. Stop it before sending another request.' })
      starting = true
      try {
        await ready
        const payload = await body(req)
        if (typeof payload.text !== 'string' || payload.text.length > 30_000 || !payload.text.trim()) throw new Error('Enter a request (up to 30,000 characters)')
        const attachments = payload.images ?? []
        if (!Array.isArray(attachments) || attachments.length > 3) throw new Error('Attach up to three images')
        const input = [{ type: 'text', text: payload.text }, { type: 'skill', name: 'openscad-studio', path: skillPath }]
        await mkdir(path.join(workspace, '.feedback'), { recursive: true })
        for (const image of attachments) {
          const match = typeof image.data === 'string' && image.data.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/)
          if (!match) throw new Error('Attachments must be PNG or JPEG images')
          const bytes = Buffer.from(match[2], 'base64')
          if (bytes.length > 2_500_000) throw new Error('Each image must be under 2.5 MB')
          const filename = path.join(workspace, '.feedback', `${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : 'png'}`)
          await writeFile(filename, bytes)
          input.push({ type: 'localImage', path: filename })
          if (image.context) input.push({ type: 'text', text: `\n\n<studio_view_metadata>\n${JSON.stringify(image.context).slice(0, 8000)}\n</studio_view_metadata>` })
        }
        const result = await codex.request('turn/start', { threadId, input })
        if (!completedTurns.has(result.turn.id)) activeTurn = result.turn.id
        return json(res, 200, { turnId: result.turn.id })
      } finally { starting = false }
    }
    if (req.method === 'POST' && url.pathname === '/api/stop') {
      if (activeTurn) await codex.request('turn/interrupt', { threadId, turnId: activeTurn })
      return json(res, 200, { ok: true })
    }
    if (req.method === 'GET' && url.pathname.startsWith('/artifact/')) {
      const relative = decodeURIComponent(url.pathname.slice('/artifact/'.length))
      if (!relative.startsWith('.renders/') && !relative.startsWith('.feedback/') && relative !== 'input.scad') return json(res, 404, { error: 'Not an artifact' })
      const filename = await realpath(path.resolve(workspace, relative))
      if (!filename.startsWith(workspace + path.sep)) return json(res, 403, { error: 'Artifact is outside the workspace' })
      const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.off': 'text/plain', '.scad': 'text/plain', '.3mf': 'model/3mf' }
      return await serve(res, filename, types[path.extname(filename)] || 'application/octet-stream')
    }
    const staticFiles = {
      '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'],
      '/vendor/three.js': ['../node_modules/three/build/three.module.js', 'text/javascript'],
      '/vendor/OrbitControls.js': ['../node_modules/three/examples/jsm/controls/OrbitControls.js', 'text/javascript'],
    }
    if (req.method === 'GET' && staticFiles[url.pathname]) {
      const [file, type] = staticFiles[url.pathname]
      return await serve(res, path.join(here, file), type)
    }
    json(res, 404, { error: 'Not found' })
  } catch (error) {
    if (!res.headersSent) json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message })
    else res.end()
  }
})

server.listen(port, '127.0.0.1', () => console.log(`E3D Codex prototype: http://127.0.0.1:${port}\nDesign workspace: ${workspace}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const client of clients) client.end()
  codex.close(); server.close(); process.exit(0)
})
