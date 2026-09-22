import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile, mkdir, readdir, realpath, open, rm } from 'node:fs/promises'
import { randomUUID, createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import { stripTypeScriptTypes } from 'node:module'
import dotenv from 'dotenv'
import { DesignWorkspace } from './workspace.mjs'
import { workspaceFiles } from '../prototype/render.mjs'
import { atomicJSON } from './history.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(repo, '.env.local'), quiet: true })
const root = path.resolve(process.env.E3D_DATA_DIR || path.join(os.homedir(), '.e3d-studio'))
let port = Number(process.env.E3D_PORT || 4318)
await mkdir(root, { recursive: true, mode: 0o700 })
const tokenPath = path.join(root, 'service-token')
let token
try { token = await readFile(tokenPath, 'utf8') } catch(e) { if(e.code !== 'ENOENT') throw e; token = randomBytes(32).toString('hex'); await writeFile(tokenPath, token, {mode:0o600}) }
// One server owns a data directory. A stale lock from a terminated process is recoverable.
const lockPath = path.join(root, 'server.lock')
try {
  const lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); await lock.close()
} catch(e) {
  if(e.code !== 'EEXIST') throw e
  const pid = Number(await readFile(lockPath, 'utf8'))
  let alive = true
  try { process.kill(pid, 0) } catch(e) { if(e.code === 'ESRCH') alive = false; else throw e }
  if(alive) throw new Error('An E3D server already owns this data directory')
  await rm(lockPath); const lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); await lock.close()
}
const projects = new Map()
const validId = id => /^[a-zA-Z0-9_-]{1,100}$/.test(id)
const json = (res,status,value) => { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(value)) }
const equal = value => { const a=Buffer.from(value || ''), b=Buffer.from(token); return a.length===b.length && timingSafeEqual(a,b) }
async function body(req) {
  let length=0; const parts=[]
  for await(const part of req) { length+=part.length; if(length>48*1024*1024) throw new Error('Upload exceeds 48 MB'); parts.push(part) }
  return JSON.parse(Buffer.concat(parts).toString('utf8'))
}
async function project(owner,id,initial) {
  if(!validId(id)) throw new Error('Invalid project identifier')
  const key=`${owner}/${id}`
  if(!projects.has(key)) {
    const dir=path.join(root,'owners',owner,id)
    if(!initial) await readFile(path.join(dir,'project.json'))
    const loading=new DesignWorkspace(dir).initialize(initial)
    projects.set(key,loading)
    loading.catch(()=>projects.delete(key))
  }
  return projects.get(key)
}
async function listing(owner) {
  const directory=path.join(root,'owners',owner); await mkdir(directory,{recursive:true})
  const list=[]
  for(const entry of await readdir(directory,{withFileTypes:true})) if(entry.isDirectory()) {
    try { list.push(JSON.parse(await readFile(path.join(directory,entry.name,'project.json'),'utf8'))) } catch(e) { if(e.code!=='ENOENT') throw e }
  }
  return list.sort((a,b)=>b.updatedAt-a.updatedAt)
}
async function serve(res,file,type) { const bytes=await readFile(file); res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(bytes) }
const server=http.createServer(async(req,res)=>{
  try {
    const trusted=equal(req.headers['x-e3d-token'])
    const localHost=[`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)
    const origin=req.headers.origin
    if(!trusted && (!localHost || (origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)))) return json(res,403,{error:'Use the Studio interface to access this workspace'})
    const owner=trusted ? createHash('sha256').update(String(req.headers['x-e3d-owner'] || '')).digest('hex') : 'local'
    const url=new URL(req.url,`http://127.0.0.1:${port}`)
    const segments=url.pathname.split('/').filter(Boolean)
    if(url.pathname==='/health') return json(res,200,{ok:true,service:'e3d-studio'})
    if(url.pathname==='/library' && req.method==='GET') {
      const {BUILT_IN_CANONICALS}=await import('../src/lib/builtin-canonicals.ts')
      return json(res,200,{projects:[],canonicals:BUILT_IN_CANONICALS.map(({id,title,description})=>({id,title,description}))})
    }
    if(url.pathname==='/library/import' && req.method==='POST') {
      const {BUILT_IN_CANONICALS}=await import('../src/lib/builtin-canonicals.ts')
      const input=await body(req), source=BUILT_IN_CANONICALS.find(p=>p.id===input.id)
      if(!source)return json(res,404,{error:'Starter not found'})
      const workspace=await project(owner,randomUUID(),{name:source.title,code:source.code})
      return json(res,201,workspace.meta)
    }
    if(url.pathname==='/api/projects') {
      if(req.method==='GET') return json(res,200,await listing(owner))
      if(req.method==='POST') {
        const input=await body(req), id=validId(input.id || '') ? input.id : randomUUID()
        const workspace=await project(owner,id,{name:String(input.name || 'Untitled design').slice(0,100),code:input.code,files:input.files})
        return json(res,201,workspace.meta)
      }
    }
    if(segments[0]==='api' && segments[1]==='projects' && segments[2]) {
      const workspace=await project(owner,segments[2]), action=segments[3]
      if(req.method==='GET' && action==='state') return json(res,200,await workspace.state())
      if(req.method==='GET' && action==='events') {
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'})
        const listener=message=>res.write(`data: ${JSON.stringify(message)}\n\n`)
        workspace.listeners.add(listener); res.write(': connected\n\n')
        const pulse=setInterval(()=>res.write(': heartbeat\n\n'),15000)
        req.on('close',()=>{workspace.listeners.delete(listener);clearInterval(pulse)})
        return
      }
      if(req.method==='POST' && action==='turn') return json(res,200,await workspace.start(await body(req)))
      if(req.method==='POST' && action==='stop') { await workspace.stop(); return json(res,200,{ok:true}) }
      if(req.method==='POST' && ['undo','redo'].includes(action)) return json(res,200,await workspace.move(action))
      if(req.method==='POST' && action==='import') { await workspace.importFiles((await body(req)).files); return json(res,200,{ok:true}) }
      if(req.method==='POST' && action==='rename') {
        const {name}=await body(req); if(typeof name!=='string' || !name.trim() || name.length>100) throw new Error('Enter a name up to 100 characters')
        workspace.meta.name=name.trim(); await atomicJSON(path.join(workspace.directory,'project.json'),workspace.meta)
        return json(res,200,workspace.meta)
      }
      if(req.method==='POST' && action==='duplicate') {
        if(workspace.busy) throw new Error('Wait for the current change before duplicating')
        workspace.busy=true;workspace.operation='duplicate'
        try {
          const files=await workspaceFiles(workspace.files), source=files.find(f=>f.name==='input.scad')
          const copy=await project(owner,randomUUID(),{name:workspace.meta.name+' copy',code:source?.data.toString('utf8'),files:files.filter(f=>f.name!=='input.scad').map(f=>({name:f.name,data:f.data.toString('base64')}))})
          return json(res,201,copy.meta)
        } finally {workspace.busy=false;workspace.operation=null}
      }
      if(req.method==='GET' && action==='source.zip') {
        if(workspace.busy) throw new Error('Wait for the current change before exporting source')
        workspace.busy=true;workspace.operation='export'
        try {
          await workspace.history.checkpoint('External file changes')
          const bytes=await workspace.history.archive()
          res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="design-${workspace.history.current.commit.slice(0,8)}.zip"`,'Cache-Control':'no-store'}); return res.end(bytes)
        } finally {workspace.busy=false;workspace.operation=null}
      }
      if(req.method==='GET' && action==='artifact') {
        const relative=decodeURIComponent(segments.slice(4).join('/'))
        const filename=await realpath(path.resolve(workspace.files,relative))
        if(!filename.startsWith(workspace.files+path.sep) || (!relative.startsWith('.renders/') && !relative.startsWith('.feedback/') && relative!=='input.scad')) return json(res,403,{error:'Not a viewable artifact'})
        const types={'.png':'image/png','.jpg':'image/jpeg','.off':'text/plain','.scad':'text/plain','.json':'application/json','.3mf':'model/3mf'}
        return serve(res,filename,types[path.extname(filename)] || 'application/octet-stream')
      }
    }
    if(req.method==='GET' && url.pathname==='/vendor/off.js') {
      res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(stripTypeScriptTypes(await readFile(path.join(repo,'src/lib/openscad/off.ts'),'utf8')))
    }
    const files={ '/':['studio/web/index.html','text/html'], '/app.js':['studio/web/app.js','text/javascript'], '/style.css':['studio/web/style.css','text/css'],
      '/vendor/three.js':['node_modules/three/build/three.module.js','text/javascript'], '/vendor/OrbitControls.js':['node_modules/three/examples/jsm/controls/OrbitControls.js','text/javascript'] }
    if(req.method==='GET' && files[url.pathname]) { const [file,type]=files[url.pathname];return serve(res,path.join(repo,file),type) }
    return json(res,404,{error:'Not found'})
  } catch(e) { if(!res.headersSent) json(res,e.code==='ENOENT'?404:400,{error:e.message}); else res.end() }
})
server.listen(port,'127.0.0.1',()=>{port=server.address().port;console.log(`E3D Studio: http://127.0.0.1:${port}`)})
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{
  for(const promise of projects.values()) (await promise).close()
  await rm(lockPath,{force:true}); server.close(); process.exit(0)
})
