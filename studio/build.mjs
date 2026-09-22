import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const command = fileURLToPath(new URL('../prototype/render.mjs', import.meta.url))

/** Keep expensive compilation outside the HTTP process. Same ordinary utility used by Codex. */
export async function buildWorkspace(directory) {
  try {
    await exec(process.execPath, [command, 'input.scad'], { cwd: directory, timeout: 120000, maxBuffer: 8 * 1024 * 1024,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR } })
  } catch(error) {
    let message = error.killed ? 'Rendering exceeded two minutes' : 'OpenSCAD could not render this design'
    try { message = JSON.parse(error.stderr).error || message } catch {}
    throw new Error(message)
  }
}
