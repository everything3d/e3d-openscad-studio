import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {DesignWorkspace} from './workspace.mjs'

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'e3d-lifecycle-'))
  t.after(()=>rm(root,{recursive:true,force:true}))
  return new DesignWorkspace(root,{}).initialize({name:'Lifecycle',code:'cube(10);'})
}

test('interrupted turns checkpoint partial edits; next request receives restored revision identity',async t=>{
  const workspace=await fixture(t), inputs=[]
  workspace.connectionReady=true
  workspace.threadId='test-thread'
  workspace.connection={closed:false,request:async(method,params)=>{
    if(method==='turn/start') {
      inputs.push(params.input)
      workspace.onEvent({method:'turn/started',params:{turn:{id:'turn-'+inputs.length}}})
      return {turn:{id:'turn-'+inputs.length}}
    }
    if(method==='turn/interrupt') {
      workspace.onEvent({method:'turn/completed',params:{turn:{id:params.turnId,status:'interrupted'}}})
      return {}
    }
    throw new Error('Unexpected transport method '+method)
  }}
  await workspace.start({text:'Grow the cube'})
  await assert.rejects(workspace.start({text:'Concurrent edit'}),/already running/)
  await writeFile(path.join(workspace.files,'input.scad'),'cube(20);')
  await workspace.stop();await workspace.queue
  assert.equal(workspace.busy,false)
  assert.equal(workspace.history.current.status,'interrupted')
  assert.equal(workspace.requests[0].status,'interrupted')
  await workspace.move('undo')
  assert.equal(await readFile(path.join(workspace.files,'input.scad'),'utf8'),'cube(10);')
  await workspace.start({text:'Make a new change'})
  const context=inputs[1].find(item=>item.type==='text' && item.text.startsWith('Application checkpoint'))
  assert.ok(context.text.includes(workspace.history.current.commit))
  assert.match(context.text,/history generation: 1/)
  await workspace.stop();await workspace.queue
})

test('failed turn dispatch releases busy state and records failure without a fake undo step',async t=>{
  const workspace=await fixture(t), original=workspace.history.current.commit
  workspace.connectionReady=true;workspace.connection={closed:false,request:async()=>{throw new Error('Provider unavailable')}}
  await assert.rejects(workspace.start({text:'Change the design'}),/Provider unavailable/)
  assert.equal(workspace.busy,false)
  assert.equal(workspace.history.current.commit,original)
  assert.equal(workspace.history.state.pending,null)
  assert.equal(workspace.requests[0].status,'failed')
})
