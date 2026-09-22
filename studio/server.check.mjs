import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {once} from 'node:events'
import os from 'node:os'
import path from 'node:path'
import {unzipSync,strFromU8} from 'fflate'

test('HTTP workspace supports import, undo/redo, export and owner isolation without model credentials',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'e3d-http-'))
  const child=spawn(process.execPath,['studio/server.mjs'],{env:{...process.env,E3D_DATA_DIR:root,E3D_PORT:'0',OPENROUTER_API_KEY:''},stdio:['ignore','pipe','pipe']})
  t.after(async()=>{child.kill('SIGTERM');await once(child,'exit');await rm(root,{recursive:true,force:true})})
  const origin=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Server did not start')),10000)
    child.on('error',reject)
    child.stdout.on('data',bytes=>{const match=String(bytes).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0])}})
  })
  async function call(route,body,headers={}) {
    const response=await fetch(origin+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined})
    const result=await response.json();return {status:response.status,result}
  }
  const {result:p}=await call('/api/projects',{name:'Acceptance',code:'color("blue") cube(10);'})
  const base='/api/projects/'+p.id
  let {result:state}=await call(base+'/state')
  assert.equal(state.runtime.configured,false);assert.equal(state.render.status,'done')
  const initial=state.history.current
  const blocked=await call(base+'/turn',{text:'Change this'})
  assert.equal(blocked.status,400);assert.match(blocked.result.error,/OPENROUTER_API_KEY/)
  const imported=await call(base+'/import',{files:[{name:'input.scad',data:Buffer.from('color("red") cube(20);').toString('base64')},{name:'icon.svg',data:Buffer.from('<svg/>').toString('base64')}]})
  assert.equal(imported.status,200)
  state=(await call(base+'/state')).result
  assert.deepEqual(state.render.bounds.size,[20,20,20]);assert.equal(state.history.canUndo,true)
  await call(base+'/undo',{})
  state=(await call(base+'/state')).result
  assert.equal(state.history.current,initial);assert.deepEqual(state.render.bounds.size,[10,10,10]);assert.equal(state.history.canRedo,true)
  await call(base+'/redo',{})
  const zip=unzipSync(new Uint8Array(await (await fetch(origin+base+'/source.zip')).arrayBuffer()))
  assert.equal(strFromU8(zip['input.scad']),'color("red") cube(20);');assert.ok(zip['icon.svg'])
  assert.deepEqual(Object.keys(zip).sort(),['icon.svg','input.scad'])
  assert.equal((await call(base+'/import',{files:[{name:'../escape.scad',data:''}]})).status,400)
  const token=await readFile(path.join(root,'service-token'),'utf8')
  const ownerA={'x-e3d-token':token,'x-e3d-owner':'alice'},ownerB={'x-e3d-token':token,'x-e3d-owner':'bob'}
  const own=await call('/api/projects',{name:'Private',code:'cube(1);'},ownerA)
  assert.equal((await call('/api/projects/'+own.result.id+'/state',null,ownerB)).status,404)
  assert.equal((await call('/api/projects',null,{Origin:'https://untrusted.example'})).status,403)
})
