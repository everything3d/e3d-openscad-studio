import * as THREE from 'three'
import { OrbitControls } from '/vendor/OrbitControls.js'
import { parseOFF } from '/vendor/off.js'

const $ = selector => document.querySelector(selector)
const host = $('#viewport'), messages = $('#messages')
let currentRender = null, model = null, renderer, camera, controls, marking = false, busy = false
let attachments = [], strokes = [], activeStroke = null, frozenContext = null
const messageNodes = new Map()
const scene = new THREE.Scene()
scene.background = new THREE.Color('#e7edf1')
scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8c98, 2.4))
const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(-50, -80, 130); scene.add(light)
const grid = new THREE.GridHelper(400, 40, 0xc2d0da, 0xd7e1e8); grid.rotation.x = Math.PI / 2; scene.add(grid)

function showError(error) { $('#error').textContent = error; $('#error').hidden = !error }
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  camera = new THREE.PerspectiveCamera(40, 1, .1, 10000); camera.up.set(0, 0, 1)
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true
  host.prepend(renderer.domElement)
  new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect()
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix()
    if (marking) drawMarkup()
  }).observe(host)
  const animate = () => { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }; animate()
} catch { $('#empty').hidden = false; $('#mark-view').disabled = true }

function meshGeometry(mesh) {
  const positions = [], colors = []
  for (let t = 0; t < mesh.triangles.length; t += 3) {
    const rgb = mesh.faceColors ? Array.from(mesh.faceColors.slice(t, t + 3)) : [110, 168, 254]
    const color = new THREE.Color().setRGB(...rgb.map(v => v / 255), THREE.SRGBColorSpace)
    for (const vertex of mesh.triangles.slice(t, t + 3)) {
      positions.push(...mesh.vertices.slice(vertex * 3, vertex * 3 + 3)); colors.push(color.r, color.g, color.b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals(); geometry.computeBoundingBox()
  return geometry
}

function setView(view = 'iso') {
  if (!model || !camera || marking) return
  const box = model.geometry.boundingBox, center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
  const extent = size.length(), distance = Math.max(20, extent * 1.5 / Math.min(camera.aspect, 1))
  const directions = { iso: [1, -1.4, 1.5], top: [0, 0, 1], front: [0, -1, 0], right: [1, 0, 0] }
  camera.up.set(...(view === 'top' ? [0, 1, 0] : [0, 0, 1]))
  camera.position.copy(center).add(new THREE.Vector3(...directions[view]).normalize().multiplyScalar(distance))
  camera.near = Math.max(.01, extent / 1000); camera.far = Math.max(10000, extent * 100)
  camera.updateProjectionMatrix(); controls.target.copy(center); controls.update()
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view))
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view))
$('#fit').onclick = () => setView('iso')

const artifactUrl = name => '/artifact/' + name.split('/').map(encodeURIComponent).join('/')
$('#download').onclick = event => { if ($('#download').getAttribute('aria-disabled') === 'true') event.preventDefault() }
let loadingId = null
async function updateRender(render) {
  const unavailable = !render || render.status !== 'done' || render.stale || render.id !== currentRender?.id
  $('#download').classList.toggle('disabled', unavailable)
  $('#download').setAttribute('aria-disabled', String(unavailable))
  $('#render-status').textContent = !render ? 'No render yet' : render.stale ? 'Source changed' : render.status === 'done' ? 'Rendered' : 'Render failed'
  $('#render-status').className = 'badge ' + (render?.status === 'done' && !render.stale ? 'good' : 'warn')
  $('#diagnostics').textContent = render ? [render.error, ...(render.logs ?? [])].filter(Boolean).join('\n') : ''
  if (!render || render.status !== 'done' || render.id === currentRender?.id || render.id === loadingId || marking) return
  loadingId = render.id
  try {
    const response = await fetch(artifactUrl(render.mesh)); if (!response.ok) throw new Error('Could not load the rendered mesh')
    const geometry = meshGeometry(parseOFF(await response.arrayBuffer()))
    const first = !model
    if (model) { scene.remove(model); model.geometry.dispose(); model.material.dispose() }
    model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, side: THREE.DoubleSide }))
    scene.add(model); grid.position.z = geometry.boundingBox.min.z - .1
    currentRender = render
    if (first) setView('iso')
    $('#dimensions').textContent = `${render.bounds.size.join(' × ')} mm · ${render.triangles.toLocaleString()} triangles`
    $('#download').href = artifactUrl(render.download); $('#download').download = 'design.3mf'
    $('#download').classList.toggle('disabled', render.stale); $('#download').setAttribute('aria-disabled', String(render.stale))
    $('#palette').replaceChildren(...render.palette.map(color => { const node = document.createElement('span'); node.className = 'swatch'; node.style.background = color; node.title = color; return node }))
    $('#render-images').replaceChildren(...render.images.map(item => {
      const link = document.createElement('a'); link.href = artifactUrl(item.path); link.target = '_blank'
      const img = document.createElement('img'); img.src = link.href; img.alt = `${item.view} inspection render`; link.append(img); return link
    }))
  } finally { loadingId = null }
}

function setBusy(value) { busy = value; $('#send').disabled = value; $('#stop').hidden = !value; $('#activity').textContent = value ? 'Working…' : '' }
async function poll() {
  try {
    const res = await fetch('/api/state'); if (!res.ok) throw new Error('Studio connection failed')
    const state = await res.json()
    if (state.model) $('#connection').textContent = state.model
    setBusy(Boolean(state.activeTurn || state.starting))
    if (state.connectionError) showError(state.connectionError)
    await updateRender(state.render)
  } catch (error) { showError(error.message) }
}
setInterval(poll, 1500); poll()

function scrollMessages() { messages.scrollTop = messages.scrollHeight }
function addMessage(id, role, text) {
  $('#welcome')?.remove()
  let node = messageNodes.get(id)
  if (!node) { node = document.createElement('div'); node.className = `message ${role}`; messageNodes.set(id, node); messages.append(node) }
  node.textContent = text; scrollMessages(); return node
}
function itemText(item) {
  return (item.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('\n')
    .replace(/<studio_view_metadata>[\s\S]*?<\/studio_view_metadata>/g, '').split('Attached view metadata (reference only):')[0].trim()
}
function showItem(item) {
  if (item.type === 'userMessage') {
    const node = addMessage(item.id, 'user', itemText(item))
    for (const part of item.content ?? []) {
      if (part.type !== 'localImage' || !part.path?.includes('/.feedback/')) continue
      const img = document.createElement('img'); img.className = 'message-image'; img.alt = 'Attached feedback or reference'
      img.onload = scrollMessages
      img.src = artifactUrl('.feedback/' + part.path.split('/.feedback/').pop()); node.append(img)
    }
    return
  }
  if (item.type === 'agentMessage') return addMessage(item.id, 'assistant', item.text || '')
  if (!['commandExecution', 'fileChange', 'imageView'].includes(item.type)) return
  let node = messageNodes.get(item.id)
  if (!node) { node = document.createElement('details'); node.className = 'tool-item'; messageNodes.set(item.id, node); messages.append(node) }
  const summary = document.createElement('summary')
  summary.textContent = item.type === 'imageView' ? 'Inspected an image' : item.type === 'fileChange' ? 'Edited project files' : item.status === 'inProgress' ? 'Running a command…' : 'Ran a command'
  const output = document.createElement('pre'); output.textContent = item.command || item.path || JSON.stringify(item.changes || [], null, 2)
  if (item.aggregatedOutput) output.textContent += '\n' + item.aggregatedOutput.slice(-4000)
  node.replaceChildren(summary, output); scrollMessages()
}

const events = new EventSource('/api/events')
events.onmessage = event => {
  const message = JSON.parse(event.data), p = message.params ?? {}
  const log = $('#activity-log'); log.textContent = (log.textContent + `${message.method}\n`).slice(-8000); log.scrollTop = log.scrollHeight
  if (message.method === 'studio/history') {
    // Codex supplies its own persisted conversation on reconnect.
    for (const turn of p.thread.turns ?? []) for (const item of turn.items ?? []) showItem(item)
    $('#connection').textContent = p.model || 'Codex connected'
  }
  if (message.method === 'item/started' || message.method === 'item/completed') showItem(p.item)
  if (message.method === 'item/agentMessage/delta') {
    const previous = messageNodes.get(p.itemId)?.textContent ?? ''
    addMessage(p.itemId, 'assistant', previous + p.delta)
  }
  if (message.method === 'turn/started') { setBusy(true); showError('') }
  if (message.method === 'turn/completed') {
    setBusy(false); if (p.turn.error) showError(p.turn.error.message || JSON.stringify(p.turn.error)); poll()
  }
  if (message.method === 'error' || message.method === 'connection/error') showError(p.error?.message || p.message || 'Codex reported an error')
}
events.onerror = () => { $('#connection').textContent = 'Reconnecting…' }

function showAttachments() {
  $('#attachments').replaceChildren(...attachments.map((item, i) => {
    const node = document.createElement('div'); node.className = 'attachment'
    const img = document.createElement('img'); img.src = item.data; img.alt = item.context?.marked ? 'Marked model view' : 'Reference image'
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove image'); remove.onclick = () => { attachments.splice(i, 1); showAttachments() }
    node.append(img, remove); return node
  }))
}
async function resizedImage(source) {
  const img = new Image(); img.src = source; await img.decode()
  const canvas = document.createElement('canvas'), scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
$('#file-input').onchange = async event => {
  try {
    for (const file of event.target.files) {
      if (attachments.length >= 3) throw new Error('Attach up to three images')
      const url = URL.createObjectURL(file)
      try { attachments.push({ data: await resizedImage(url) }) } finally { URL.revokeObjectURL(url) }
    }
    showAttachments()
  } catch (error) { showError(error.message) }
  event.target.value = ''
}

$('#composer').onsubmit = async event => {
  event.preventDefault()
  const text = $('#prompt').value.trim(); if (!text || busy) return
  setBusy(true); showError('')
  try {
    const res = await fetch('/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, images: attachments }) })
    const result = await res.json(); if (!res.ok) throw new Error(result.error)
    $('#prompt').value = ''; attachments = []; showAttachments()
  } catch (error) { setBusy(false); showError(error.message) }
}
$('#prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#composer').requestSubmit() } }
$('#stop').onclick = async () => { try { const res = await fetch('/api/stop', { method: 'POST' }); if (!res.ok) throw new Error((await res.json()).error) } catch (error) { showError(error.message) } }
document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => { $('#prompt').value = button.dataset.prompt; $('#prompt').focus() })

const markup = $('#markup')
function drawMarkup() {
  const rect = host.getBoundingClientRect(); markup.width = rect.width * devicePixelRatio; markup.height = rect.height * devicePixelRatio
  const ctx = markup.getContext('2d'); ctx.strokeStyle = '#e75440'; ctx.fillStyle = '#e75440'; ctx.lineWidth = 4 * devicePixelRatio; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    if (stroke.length === 1) { ctx.beginPath(); ctx.arc(stroke[0][0] * markup.width, stroke[0][1] * markup.height, 5 * devicePixelRatio, 0, Math.PI * 2); ctx.fill() }
    else { ctx.beginPath(); stroke.forEach(([x,y], i) => i ? ctx.lineTo(x * markup.width, y * markup.height) : ctx.moveTo(x * markup.width, y * markup.height)); ctx.stroke() }
  }
}
function endMark() {
  marking = false; controls.enabled = true
  for (const id of ['#frozen', '#markup', '#annotation-hint', '#mark-actions']) $(id).hidden = true
  $('#mark-view').hidden = false; strokes = []; poll()
}
$('#mark-view').onclick = async () => {
  if (!model || !renderer) return
  if (attachments.length >= 3) return showError('Remove an attachment before adding a marked view')
  marking = true; controls.enabled = false; renderer.render(scene, camera)
  $('#frozen').src = renderer.domElement.toDataURL('image/png'); await $('#frozen').decode()
  frozenContext = { renderId: currentRender.id, sourceHash: currentRender.sourceHash, marked: true,
    camera: { position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(), fov: camera.fov, aspect: camera.aspect } }
  for (const id of ['#frozen', '#markup', '#annotation-hint', '#mark-actions']) $(id).hidden = false
  $('#mark-view').hidden = true; strokes = []; drawMarkup()
}
const normalizedPoint = event => { const rect = markup.getBoundingClientRect(); return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height] }
markup.onpointerdown = event => { markup.setPointerCapture(event.pointerId); activeStroke = [normalizedPoint(event)]; strokes.push(activeStroke); drawMarkup() }
markup.onpointermove = event => { if (activeStroke) { activeStroke.push(normalizedPoint(event)); drawMarkup() } }
markup.onpointerup = markup.onpointercancel = () => { activeStroke = null }
$('#undo-stroke').onclick = () => { strokes.pop(); drawMarkup() }
$('#cancel-mark').onclick = endMark
$('#attach-mark').onclick = async () => {
  const canvas = document.createElement('canvas'); canvas.width = $('#frozen').naturalWidth; canvas.height = $('#frozen').naturalHeight
  const ctx = canvas.getContext('2d'); ctx.drawImage($('#frozen'), 0, 0); ctx.drawImage(markup, 0, 0, canvas.width, canvas.height)
  attachments.push({ data: await resizedImage(canvas.toDataURL('image/png')), context: frozenContext })
  showAttachments(); endMark(); $('#prompt').focus()
}
