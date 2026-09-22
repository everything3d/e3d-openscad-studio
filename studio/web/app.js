import * as THREE from 'three'
import { OrbitControls } from './vendor/OrbitControls.js'
import { parseOFF } from './vendor/off.js'

const $ = selector => document.querySelector(selector)
const host = $('#viewport'), messages = $('#messages'), welcomeTemplate = $('#welcome').cloneNode(true)
let projectId, events, latestState, comparing = false, beforeRender = null
const base = new URL('.', location.href)
const api = suffix => new URL(`api/projects/${projectId}/${suffix}`, base).href
const artifactUrl = name => api('artifact/' + name.split('/').map(encodeURIComponent).join('/'))
async function action(name, payload) {
  const response = await fetch(api(name), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload ?? {}) })
  const result = await response.json(); if(!response.ok) throw new Error(result.error)
  return result
}
function saveDraft() {
  if(!projectId) return
  try { localStorage.setItem('e3d-draft:' + projectId, JSON.stringify({text:$('#prompt').value, attachments})) }
  catch { showError('This draft is too large to save in the browser. Keep this page open until you send it.') }
}

let currentRender = null, model = null, renderer, camera, controls, marking = false, busy = false
let attachments = [], strokes = [], activeStroke = null, frozenContext = null, frozenCamera = null
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
  const animate = () => { requestAnimationFrame(animate); if(!marking)controls.update(); renderer.render(scene, camera) }; animate()
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
  const expectedProject=projectId, expectedComparison=comparing
  try {
    const response = await fetch(artifactUrl(render.mesh)); if (!response.ok) throw new Error('Could not load the rendered mesh')
    const geometry = meshGeometry(parseOFF(await response.arrayBuffer()))
    if (marking || projectId!==expectedProject || comparing!==expectedComparison) { geometry.dispose(); return }
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

function setBusy(value) {
  busy = value; $('#send').disabled = value || !latestState?.runtime.configured
  $('#stop').hidden = !value || latestState?.operation!=='model'; $('#activity').textContent = value ? 'Working…' : ''
  for (const id of ['#new-project','#open-library','#project','#rename-project','#duplicate-project','#import-assets']) $(id).disabled = value || marking
}
let pollRunning = false, disconnected = false
async function poll() {
  if (!projectId || pollRunning) return
  pollRunning = true
  const expected = projectId
  try {
    const res = await fetch(api('state')); if (!res.ok) throw new Error('Studio connection failed')
    const state = await res.json(); if(projectId !== expected) return
    if(disconnected){showError('');disconnected=false}
    latestState = state
    setBusy(state.busy)
    $('#connection').textContent = state.runtime.configured ? `OpenRouter · ${state.runtime.model==='openai/gpt-6-astra'?'GPT-6 Astra':state.runtime.model}` : 'Assistant not configured'
    $('h1').textContent=state.project.name
    if(state.error) showError(state.error)
    else if(!state.runtime.configured) showError('Add OPENROUTER_API_KEY to .env.local and restart Studio to enable the assistant. You can still inspect, import, and export designs.')
    $('#undo').disabled = state.busy || marking || !state.history.canUndo
    $('#redo').disabled = state.busy || marking || !state.history.canRedo
    $('#undo').title = state.history.canUndo ? `Undo: ${state.history.entries[state.history.cursor].label}` : 'Nothing to undo'
    $('#redo').title = state.history.canRedo ? `Redo: ${state.history.entries[state.history.cursor + 1].label}` : 'Nothing to redo'
    $('#save-status').textContent = state.busy ? 'Change in progress' : 'Saved locally'
    $('#history-list').replaceChildren(...state.history.entries.map((entry,i) => {
      const li=document.createElement('li'); li.textContent=(i===state.history.cursor?'Current: ':'')+entry.label
      li.className = i===state.history.cursor?'current':i>state.history.cursor?'undone':''; return li
    }))
    const lastChange=state.requests.findLast(request => request.after===state.history.current && request.beforeRender?.status==='done')
    beforeRender=lastChange?.beforeRender ?? state.history.entries[state.history.cursor]?.beforeRender ?? null
    $('#compare').disabled = state.busy || !beforeRender || marking
    $('#mark-view').disabled = comparing || !renderer
    if(!beforeRender) comparing=false
    $('#compare').textContent=comparing?'Show current':'Show before'; $('#compare').setAttribute('aria-pressed',String(comparing))
    for(const request of state.requests) showRequest(request)
    await updateRender(comparing ? beforeRender : state.render)
    if(comparing) {
      $('#render-status').textContent='Before this change'
      $('#download').classList.add('disabled'); $('#download').setAttribute('aria-disabled','true')
    }
  } catch(error) {
    disconnected=true;$('#connection').textContent='Reconnecting…';$('#save-status').textContent='Connection lost'
    $('#send').disabled=true;showError('Studio is reconnecting. Your saved design is safe; keep this page open.')
  } finally {pollRunning=false}
}
setInterval(poll,1500)

function scrollMessages() { messages.scrollTop = messages.scrollHeight }
function formatAssistant(node,text) {
  node.replaceChildren()
  // Small safe text formatter: never inject model HTML or expose local absolute paths.
  const pattern=/\[([^\]\n]+)\]\(([^)\n]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*/g
  let cursor=0
  for(const match of text.matchAll(pattern)) {
    node.append(document.createTextNode(text.slice(cursor,match.index)))
    const [,label,target,code,bold]=match
    if(label) {
      const relative=target.includes('/.renders/')?'.renders/'+target.split('/.renders/').pop():target.endsWith('/input.scad')?'input.scad':null
      const url=relative && !relative.split('/').includes('..')?artifactUrl(relative):/^https?:\/\//.test(target)?target:null
      const item=document.createElement(url?'a':'span');item.textContent=label
      if(url){item.href=url;item.target='_blank';item.rel='noopener noreferrer'}
      node.append(item)
    } else {const item=document.createElement(code?'code':'strong');item.textContent=code||bold;node.append(item)}
    cursor=match.index+match[0].length
  }
  node.append(document.createTextNode(text.slice(cursor)))
}
function addMessage(id, role, text) {
  $('#welcome')?.remove()
  let node = messageNodes.get(id)
  if (!node) { node = document.createElement('div'); node.className = `message ${role}`; messageNodes.set(id, node); messages.append(node) }
  if(node.dataset.sourceText!==text){const follow=messages.scrollHeight-messages.scrollTop-messages.clientHeight<100;node.dataset.sourceText=text;if(role==='assistant')formatAssistant(node,text);else node.textContent=text;if(follow)scrollMessages()} return node
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
  if (!node) { node = document.createElement('details'); node.className = 'tool-item'; messageNodes.set(item.id, node); $('#tool-activity').append(node) }
  const summary = document.createElement('summary')
  summary.textContent = item.type === 'imageView' ? 'Inspected an image' : item.type === 'fileChange' ? 'Edited project files' : item.status === 'inProgress' ? 'Running a command…' : 'Ran a command'
  const output = document.createElement('pre'); output.textContent = item.command || item.path || JSON.stringify(item.changes || [], null, 2)
  if (item.aggregatedOutput) output.textContent += '\n' + item.aggregatedOutput.slice(-4000)
  node.replaceChildren(summary, output)
}

function showRequest(request) {
  const signature=JSON.stringify(request)
  if(messageNodes.get('request:'+request.id)?.dataset.signature===signature)return
  const node=addMessage('request:'+request.id, 'user', request.text);node.dataset.signature=signature;node.textContent=request.text
  for(const item of request.images) {
    const img=document.createElement('img'); img.className='message-image'; img.alt='Attached feedback or reference'; img.src=artifactUrl(item.path); node.append(img)
  }
  if(request.response) addMessage('result:'+request.id,'assistant',request.response)
  if(request.status !== 'working') {
    const inspected=request.inspected.length ? ` · Inspected ${request.inspected.length} image${request.inspected.length===1?'':'s'}` : ''
    addMessage('status:'+request.id, 'request-status', request.status+inspected+(request.error?' · '+request.error:''))
  }
}
function connectEvents() {
  events?.close(); events=new EventSource(api('events'))
  events.onmessage=event=>{
    const message=JSON.parse(event.data), p=message.params ?? {}
    $('#activity-log').textContent=($('#activity-log').textContent+message.method+'\n').slice(-8000)
    if(message.method==='item/started' || message.method==='item/completed') {
      if(p.item.type!=='userMessage' && p.item.type!=='agentMessage') showItem(p.item)
      if(p.item.type==='agentMessage' && message.method==='item/completed') {
        const id='live:'+p.item.id;messageNodes.get(id)?.remove();messageNodes.delete(id);poll()
      }
    }
    if(message.method==='item/agentMessage/delta') {
      const node=messageNodes.get('live:'+p.itemId)
      addMessage('live:'+p.itemId,'assistant',(node?.dataset.sourceText ?? '')+p.delta)
    }
    if(message.method==='studio/settled') {
      for(const [id,node] of messageNodes) if(id.startsWith('live:')) {node.remove();messageNodes.delete(id)}
      poll()
    }
    if(message.method==='error' || message.method==='studio/error') showError(p.error?.message || p.message || 'Request failed')
  }
}
async function loadProjects(selected) {
  const response=await fetch(new URL('api/projects',base)); if(!response.ok) throw new Error('Could not list designs')
  let projects=await response.json()
  if(!projects.length) {
    const created=await fetch(new URL('api/projects',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'My first design'})})
    if(!created.ok) throw new Error((await created.json()).error)
    projects=[await created.json()]
  }
  $('#project').replaceChildren(...projects.map(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name;return option}))
  const requested=selected || new URL(location.href).searchParams.get('project') || localStorage.getItem('e3d-selected:'+base.pathname)
  await selectProject(projects.some(p=>p.id===requested)?requested:projects[0].id)
}
async function selectProject(id) {
  saveDraft(); events?.close(); projectId=id; $('#project').value=id
  localStorage.setItem('e3d-selected:'+base.pathname,id)
  const url=new URL(location.href);url.searchParams.set('project',id);history.replaceState(null,'',url)
  comparing=false; beforeRender=null; currentRender=null; latestState=null
  if(model) {scene.remove(model);model.geometry.dispose();model.material.dispose();model=null}
  messageNodes.clear();messages.replaceChildren(welcomeTemplate.cloneNode(true));$('#tool-activity').replaceChildren();$('#activity-log').textContent=''; attachments=[];$('#prompt').value='';showError('')
  try {const draft=JSON.parse(localStorage.getItem('e3d-draft:'+id)||'null');if(draft){attachments=draft.attachments;$('#prompt').value=draft.text}} catch {}
  showAttachments(); $('#source-bundle').href=api('source.zip'); $('#view-source').href=artifactUrl('input.scad')
  connectEvents(); await poll(); scrollMessages()
}
messages.addEventListener('click',event=>{const button=event.target.closest('[data-prompt]');if(button){$('#prompt').value=button.dataset.prompt;$('#prompt').focus();saveDraft()}})
$('#open-library').onclick=async()=>{
  $('#library-dialog').showModal();$('#library-items').textContent='Loading designs…'
  try {
    const res=await fetch(new URL('library',base));if(!res.ok)throw new Error((await res.json()).error)
    const library=await res.json();$('#library-items').replaceChildren()
    for(const [kind,items] of [['starter',library.canonicals],['project',library.projects]]) for(const item of items){
      const button=document.createElement('button');button.className='library-item';button.textContent=item.title || item.name
      button.onclick=async()=>{
        button.disabled=true
        try{
          const response=await fetch(new URL('library/import',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,kind})})
          if(!response.ok)throw new Error((await response.json()).error)
          await loadProjects((await response.json()).id);$('#library-dialog').close()
        }catch(e){showError(e.message);$('#library-dialog').close()}finally{button.disabled=false}
      };$('#library-items').append(button)
    }
    if(!$('#library-items').children.length)$('#library-items').textContent='No saved designs yet.'
  }catch(e){$('#library-items').textContent=e.message}
}
$('#close-library').onclick=()=>$('#library-dialog').close()
$('#project').onchange=()=>selectProject($('#project').value).catch(e=>showError(e.message))
$('#new-project').onclick=async()=>{
  try {
    const response=await fetch(new URL('api/projects',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Untitled design'})})
    if(!response.ok) throw new Error((await response.json()).error)
    await loadProjects((await response.json()).id)
  } catch(e) {showError(e.message)}
}
$('#duplicate-project').onclick=async()=>{try{await loadProjects((await action('duplicate')).id)}catch(e){showError(e.message)}}
$('#rename-project').onclick=async()=>{
  const name=prompt('Design name',latestState?.project.name);if(!name)return
  try{await action('rename',{name});await loadProjects(projectId)}catch(e){showError(e.message)}
}
async function moveHistory(direction) {
  if(busy || marking || !latestState?.history[direction==='undo'?'canUndo':'canRedo']) return
  try{setBusy(true);comparing=false;await action(direction);await poll()}catch(e){showError(e.message);setBusy(false)}
}
$('#undo').onclick=()=>moveHistory('undo');$('#redo').onclick=()=>moveHistory('redo')
$('#compare').onclick=()=>{comparing=!comparing;poll()}
$('#import-assets').onclick=()=>$('#asset-input').click()
$('#asset-input').onchange=async event=>{
  try {
    setBusy(true)
    const files=[]
    for(const file of event.target.files) {
      if(file.size>32*1024*1024)throw new Error('An asset exceeds 32 MB')
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)})
      files.push({name:file.name,data})
    }
    await action('import',{files}); await poll()
  }catch(e){showError(e.message);setBusy(false)}
  event.target.value=''
}
$('#attach-reference').onclick=()=>$('#file-input').click()
$('#prompt').oninput=saveDraft
loadProjects().catch(e=>showError(e.message))

function showAttachments() {
  saveDraft()
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
    await action('turn', {text, images:attachments})
    $('#prompt').value = ''; attachments = []; showAttachments()
  } catch (error) { setBusy(false); showError(error.message) }
}
$('#prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#composer').requestSubmit() } }
$('#stop').onclick = async () => { try { await action('stop') } catch (error) { showError(error.message) } }
document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => { $('#prompt').value = button.dataset.prompt; $('#prompt').focus() })

const markup = $('#markup')
let markUndo=[],markRedo=[]
const copyStrokes=()=>strokes.map(stroke=>stroke.map(point=>[...point]))
function undoMark(){if(markUndo.length){markRedo.push(copyStrokes());strokes=markUndo.pop();drawMarkup()}}
function redoMark(){if(markRedo.length){markUndo.push(copyStrokes());strokes=markRedo.pop();drawMarkup()}}
function drawMarkup() {
  const rect = host.getBoundingClientRect(); markup.width = rect.width * devicePixelRatio; markup.height = rect.height * devicePixelRatio
  const ctx = markup.getContext('2d'); ctx.strokeStyle = '#e75440'; ctx.fillStyle = '#e75440'; ctx.lineWidth = 4 * devicePixelRatio; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  let pin=0
  for (const stroke of strokes) {
    if (stroke.length === 1) { ctx.beginPath(); ctx.arc(stroke[0][0] * markup.width, stroke[0][1] * markup.height, 11 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();ctx.fillStyle='white';ctx.font=`bold ${12*devicePixelRatio}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(++pin),stroke[0][0]*markup.width,stroke[0][1]*markup.height);ctx.fillStyle='#e75440' }
    else { ctx.beginPath(); stroke.forEach(([x,y], i) => i ? ctx.lineTo(x * markup.width, y * markup.height) : ctx.moveTo(x * markup.width, y * markup.height)); ctx.stroke() }
  }
}
function endMark() {
  marking = false; controls.enabled = true; setBusy(busy)
  for (const id of ['#frozen', '#markup', '#annotation-hint', '#mark-actions']) $(id).hidden = true
  $('#mark-view').hidden = false; strokes = []; activeStroke=null; poll()
}
$('#mark-view').onclick = async () => {
  if (!model || !renderer || comparing) return
  if (attachments.length >= 3) return showError('Remove an attachment before adding a marked view')
  marking = true; controls.enabled = false; setBusy(busy); renderer.render(scene, camera); frozenCamera=camera.clone()
  $('#frozen').src = renderer.domElement.toDataURL('image/png'); await $('#frozen').decode()
  frozenContext = { renderId: currentRender.id, sourceHash: currentRender.sourceHash, marked: true,
    camera: { position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(), fov: camera.fov, aspect: camera.aspect } }
  for (const id of ['#frozen', '#markup', '#annotation-hint', '#mark-actions']) $(id).hidden = false
  $('#mark-view').hidden = true; strokes = [];markUndo=[];markRedo=[]; drawMarkup()
}
const normalizedPoint = event => { const rect = markup.getBoundingClientRect(); return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height] }
let movingPin=false
markup.onpointerdown=event=>{
  markup.setPointerCapture(event.pointerId); markUndo.push(copyStrokes());markRedo=[]
  const point=normalizedPoint(event),rect=markup.getBoundingClientRect()
  activeStroke=strokes.find(s=>s.length===1 && Math.hypot((s[0][0]-point[0])*rect.width,(s[0][1]-point[1])*rect.height)<14)
  movingPin=Boolean(activeStroke)
  if(!activeStroke){activeStroke=[point];strokes.push(activeStroke)}
  drawMarkup()
}
markup.onpointermove=event=>{if(activeStroke){if(movingPin)activeStroke[0]=normalizedPoint(event);else activeStroke.push(normalizedPoint(event));drawMarkup()}}
markup.onpointerup=markup.onpointercancel=()=>{activeStroke=null;movingPin=false}
$('#undo-stroke').onclick=undoMark;$('#redo-stroke').onclick=redoMark
$('#clear-strokes').onclick=()=>{markUndo.push(copyStrokes());markRedo=[];strokes=[];drawMarkup()}
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey || event.metaKey) || !['z','y'].includes(event.key.toLowerCase()))return
  if(event.target.closest('textarea,input,[contenteditable="true"]'))return
  event.preventDefault()
  const redo=event.shiftKey || event.key.toLowerCase()==='y'
  if(marking)redo?redoMark():undoMark();else moveHistory(redo?'redo':'undo')
})
$('#cancel-mark').onclick = endMark
$('#attach-mark').onclick = async () => {
  const canvas = document.createElement('canvas'); canvas.width = $('#frozen').naturalWidth; canvas.height = $('#frozen').naturalHeight
  const ctx = canvas.getContext('2d'); ctx.drawImage($('#frozen'), 0, 0); ctx.drawImage(markup, 0, 0, canvas.width, canvas.height)
  const raycaster=new THREE.Raycaster()
  const pins=strokes.filter(stroke=>stroke.length===1).map((stroke,index)=>{
    const [x,y]=stroke[0];raycaster.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),frozenCamera)
    const hit=raycaster.intersectObject(model)[0]
    return {number:index+1,screen:[x,y],worldPoint:hit?.point.toArray() ?? null}
  })
  attachments.push({ data: await resizedImage(canvas.toDataURL('image/png')), context: {...frozenContext, marks:copyStrokes(),pins} })
  showAttachments(); endMark(); $('#prompt').focus()
}
