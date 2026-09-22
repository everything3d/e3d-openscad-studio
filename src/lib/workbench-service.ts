import 'server-only'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const port = Number(process.env.E3D_PORT || 4318)
const origin = `http://127.0.0.1:${port}`
const root = path.resolve(process.env.E3D_DATA_DIR || path.join(os.homedir(), '.e3d-studio'))
const globalService = globalThis as typeof globalThis & { e3dStarting?: Promise<void>; e3dChild?: ChildProcess }

async function ensureService() {
  try { if ((await fetch(origin + '/health', { cache: 'no-store' })).ok) return } catch {}
  if (!globalService.e3dStarting) {
    globalService.e3dStarting = (async () => {
      const child = spawn(process.execPath, [path.join(process.cwd(), 'studio/server.mjs')], {
        cwd: process.cwd(), env: process.env, stdio: ['ignore', 'ignore', 'pipe'],
      })
      globalService.e3dChild = child
      let failure: Error | undefined
      child.on('error', error => { failure = error })
      child.on('exit', code => { if (code) failure = new Error('The workspace service failed to start') })
      // Avoid filling a pipe; provider/API secrets are never forwarded into application logs.
      child.stderr?.on('data', () => {})
      for (let attempt = 0; attempt < 40; attempt++) {
        if (failure) throw failure
        try { if ((await fetch(origin + '/health', { cache: 'no-store' })).ok) return } catch {}
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('Workspace service is unavailable. Run npm run studio on a persistent Node host.')
    })().finally(() => { globalService.e3dStarting = undefined })
  }
  await globalService.e3dStarting
}

export async function workbenchFetch(userId: string, pathname: string, init: RequestInit = {}) {
  await ensureService()
  const token = await readFile(path.join(root, 'service-token'), 'utf8')
  const headers = new Headers(init.headers)
  headers.set('x-e3d-token', token); headers.set('x-e3d-owner', userId)
  return fetch(origin + pathname, { ...init, headers, cache: 'no-store' })
}
