/**
 * A file in a project's workspace (SVG, DXF, STL, .scad library, …).
 * The OpenSCAD code can reference it by name: `import("logo.svg")`.
 */
export interface WorkspaceFile {
  name: string
  /** File bytes, base64-encoded so they survive JSON. */
  data: string
  size: number
  addedAt: number
}

/** Sidebar listing of a project. */
export interface ProjectSummary {
  id: string
  name: string
  forkedFrom: string | null
  canonicalDesignId: string | null
  canonicalVersionId: string | null
  canonicalTitle: string | null
  canonicalHasNewerVersion: boolean
  messageCount: number
  updatedAt: number
}

/** Everything the studio needs to open a project. */
export interface FullProject {
  id: string
  name: string
  code: string
  forkedFrom: string | null
  canonicalDesignId: string | null
  canonicalVersionId: string | null
  canonicalTitle: string | null
  canonicalVersionNumber: number | null
  canonicalHasNewerVersion: boolean
  files: WorkspaceFile[]
  createdAt: number
  updatedAt: number
}

/** A gallery-safe canonical payload. Large source and file data are omitted. */
export interface CanonicalSummary {
  id: string
  title: string
  description: string
  category: string | null
  currentVersionId: string
  versionNumber: number
  thumbnail: string | null
  fileCount: number
  isOwner: boolean
  updatedAt: number
}

/** The complete current canonical version shown in the canonical detail view. */
export interface CanonicalDetail extends CanonicalSummary {
  code: string
  files: WorkspaceFile[]
  modificationGuide: string
  changeSummary: string | null
  createdAt: number
}

export interface StarterDraft {
  title: string
  description: string
  modificationGuide: string
  reusableChanges: string[]
  derivativeSpecificRisks: string[]
}

export const CANONICAL_LIMITS = {
  title: 100,
  description: 2_000,
  category: 60,
  modificationGuide: 4_000,
  changeSummary: 1_000,
  thumbnailBytes: 300_000,
} as const

/**
 * Name a project gets before anything is known about it. While a project still
 * carries this name it is considered unnamed, and the first chat message can
 * auto-name it (see `generateProjectName`).
 */
export const PLACEHOLDER_PROJECT_NAME = 'Untitled project'

export const DEFAULT_CODE = `// Welcome to E3D OpenSCAD Studio.
// Describe what you want to build in the chat and the AI will write
// the OpenSCAD code here. You can also edit it directly.

$fn = 64;

difference() {
  cube([30, 30, 30], center = true);
  sphere(r = 19);
}
`
