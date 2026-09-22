import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

/** A transport adapter. Codex owns tools, reasoning, history, and compaction. */
export class CodexConnection {
  constructor({ cwd, env = process.env, binary = process.env.CODEX_BIN || 'codex', onEvent = () => {} }) {
    this.pending = new Map()
    this.nextId = 0
    this.onEvent = onEvent
    this.child = spawn(binary, ['app-server', '--listen', 'stdio://'], {
      cwd, env, stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.stderr = ''
    this.child.stdin.on('error', () => {}) // Child exit rejects outstanding RPCs below.
    this.child.stderr.on('data', data => { this.stderr = (this.stderr + data).slice(-4000) })
    createInterface({ input: this.child.stdout }).on('line', line => {
      let message
      try { message = JSON.parse(line) } catch { return }
      if (message.id !== undefined && !message.method) {
        const entry = this.pending.get(message.id)
        if (!entry) return
        this.pending.delete(message.id)
        clearTimeout(entry.timer)
        if (message.error) entry.reject(new Error(message.error.message))
        else entry.resolve(message.result)
      } else if (message.method) {
        // Unexpected requests are visible, never silently auto-approved.
        if (message.id !== undefined) {
          this.child.stdin.write(JSON.stringify({ id: message.id, error: {
            code: -32601, message: 'This minimal client does not handle interactive approval requests.',
          } }) + '\n')
        }
        this.onEvent(message)
      }
    })
    const fail = error => {
      this.closed = true
      for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(error) }
      this.pending.clear()
      this.onEvent({ method: 'connection/error', params: { message: error.message } })
    }
    this.child.on('error', fail)
    this.child.on('exit', code => fail(new Error(`Codex stopped (exit ${code ?? 'signal'}). Restart the prototype to reconnect.`)))
  }

  request(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('Codex is disconnected'))
    return new Promise((resolve, reject) => {
      const id = ++this.nextId
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex request timed out: ${method}`))
      }, 60_000)
      this.pending.set(id, { resolve, reject, timer })
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    })
  }

  async initialize() {
    await this.request('initialize', {
      clientInfo: { name: 'e3d-cad-prototype', title: 'E3D CAD prototype', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    })
    this.child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
  }

  close() { this.child.stdin.end(); this.child.kill() }
}
