import type { Project, Settings, ChatMessage } from './types'

const PROJECTS_KEY = 'e3d.projects.v1'
const SETTINGS_KEY = 'e3d.settings.v1'
const ACTIVE_KEY = 'e3d.activeProject.v1'

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

export const DEFAULT_CODE = `// Welcome to E3D OpenSCAD Studio.
// Describe what you want to build in the chat and the AI will write
// the OpenSCAD code here. You can also edit it directly.

$fn = 64;

difference() {
  cube([30, 30, 30], center = true);
  sphere(r = 19);
}
`

// ---- Projects -------------------------------------------------------------

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

export function createProject(name?: string): Project {
  const now = Date.now()
  return {
    id: uid(),
    name: name || 'Untitled project',
    messages: [],
    code: DEFAULT_CODE,
    createdAt: now,
    updatedAt: now,
  }
}

export function forkProject(source: Project): Project {
  const now = Date.now()
  return {
    id: uid(),
    name: `${source.name} (fork)`,
    // Deep clone messages so edits don't leak back into the parent.
    messages: source.messages.map((m) => ({ ...m })),
    code: source.code,
    forkedFrom: source.id,
    createdAt: now,
    updatedAt: now,
  }
}

export function makeMessage(
  role: ChatMessage['role'],
  content: string,
  code?: string,
): ChatMessage {
  return { id: uid(), role, content, code, createdAt: Date.now() }
}

// ---- Active project id ----------------------------------------------------

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function saveActiveId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

// ---- Settings -------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
