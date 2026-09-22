import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { runtimeOptions } from './runtime.mjs'

test('application runtime uses explicit OpenRouter auth and excludes application secrets', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'e3d-runtime-'));t.after(()=>rm(root,{recursive:true,force:true}))
  const options=await runtimeOptions(root,{PATH:'/bin',HOME:'/home/example',OPENROUTER_API_KEY:'test-key',DATABASE_URL:'private',CLERK_SECRET_KEY:'private',OPENAI_API_KEY:'personal',STUDIO_MODEL:'provider/model'})
  assert.equal(options.config.model_provider,'openrouter')
  assert.equal(options.config.model_providers.openrouter.requires_openai_auth,false)
  assert.equal(options.env.CODEX_HOME,path.join(root,'runtime'))
  assert.equal(options.env.OPENROUTER_API_KEY,'test-key')
  for(const key of ['DATABASE_URL','CLERK_SECRET_KEY','OPENAI_API_KEY']) assert.equal(options.env[key],undefined)
  assert.equal(options.config.model,'provider/model')
  assert.ok(options.config.shell_environment_policy.exclude.includes('OPENROUTER_API_KEY'))
  assert.ok(!(await readFile(path.join(root,'runtime/e3d-provider.json'),'utf8')).includes('test-key'))
  const startup = await readFile(path.join(root,'runtime/config.toml'),'utf8')
  assert.match(startup,/model_provider = "openrouter"/)
  assert.ok(startup.includes('OPENROUTER_API_KEY'))
  assert.ok(!startup.includes('test-key'))
  assert.equal(options.config.model_providers.openrouter.auth.command,process.execPath)
  assert.equal((await runtimeOptions(root,{})).hasKey,false)
})
