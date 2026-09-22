import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CodexConnection } from '../prototype/codex.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Inference configuration, not an agent loop. Never fall back to personal auth. */
export async function runtimeOptions(dataRoot, environment = process.env) {
  const codexHome = path.join(dataRoot, 'runtime')
  await mkdir(codexHome, { recursive: true, mode: 0o700 })
  const model = environment.STUDIO_MODEL || 'openai/gpt-6-astra'
  const config = {
    model, model_provider: 'openrouter',
    model_providers: { openrouter: {
      name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1',
      auth: { command: process.execPath, args: ['-e', 'process.stdout.write(process.env.OPENROUTER_API_KEY || "")'] },
      wire_api: 'responses', requires_openai_auth: false,
    } },
    shell_environment_policy: { inherit: 'all', include_only: ['PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'LANG', 'LC_*', 'E3D_*'],
      exclude: ['OPENROUTER_API_KEY', '*TOKEN*', '*SECRET*', '*PASSWORD*'] },
  }
  // Only pass environment needed by the runtime; never inherit the app's database/auth keys.
  const env = {}
  for (const key of ['PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'LANG', 'SYSTEMROOT', 'WINDIR']) {
    if (environment[key]) env[key] = environment[key]
  }
  Object.assign(env, {
    CODEX_HOME: codexHome,
    E3D_CAD_RENDERER: path.join(repo, 'prototype/render.mjs'),
    E3D_FONT_CATALOG: path.join(repo, 'src/lib/openscad/fonts.ts'),
  })
  if (environment.OPENROUTER_API_KEY) env.OPENROUTER_API_KEY = environment.OPENROUTER_API_KEY
  // Human-readable, non-secret record of runtime configuration; actual overrides go via RPC.
  await writeFile(path.join(codexHome, 'e3d-provider.json'), JSON.stringify(config, null, 2), { mode: 0o600 })
  // Load the provider before initialize/model discovery, not only at thread/start.
  const tomlValue = value => Array.isArray(value) ? `[${value.map(tomlValue).join(', ')}]`
    : value && typeof value === 'object' ? `{ ${Object.entries(value).map(([k,v]) => `${JSON.stringify(k)} = ${tomlValue(v)}`).join(', ')} }`
    : JSON.stringify(value)
  await writeFile(path.join(codexHome, 'config.toml'), Object.entries(config).map(([key,value]) => `${key} = ${tomlValue(value)}`).join('\n') + '\n', { mode: 0o600 })
  return { env, config, model, hasKey: Boolean(env.OPENROUTER_API_KEY),
    binary: environment.CODEX_BIN || path.join(repo, 'node_modules/.bin/codex') }
}

export function connectRuntime(options, cwd, onEvent) {
  return new CodexConnection({ cwd, env: options.env, binary: options.binary, onEvent })
}
