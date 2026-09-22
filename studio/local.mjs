import { spawn } from 'node:child_process'
import { mkdir, open } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(repo, '.env.local'), quiet: true })
const root = path.resolve(process.env.E3D_DATA_DIR || path.join(os.homedir(), '.e3d-studio'))
const origin = `http://127.0.0.1:${process.env.E3D_PORT || 4318}`
async function ready() {
  try { const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(1000)});return r.ok && (await r.json()).service==='e3d-studio' } catch { return false }
}
if (await ready()) console.log(`Studio is already running: ${origin}`)
else {
  await mkdir(root,{recursive:true,mode:0o700})
  const logPath=path.join(root,'service.log'), log=await open(logPath,'a',0o600)
  const child=spawn(process.execPath,[path.join(repo,'studio/server.mjs')],{
    cwd:repo,env:process.env,detached:true,stdio:['ignore',log.fd,log.fd],
  })
  let failure
  child.on('error',error=>{failure=error})
  child.unref();await log.close()
  for(let attempt=0;attempt<50 && !failure;attempt++) {
    if(await ready()){console.log(`Studio is running: ${origin}\nLog: ${logPath}`);process.exit(0)}
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  throw new Error(failure?.message || `Studio did not start. Check ${logPath}`)
}
