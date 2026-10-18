/**
 * A file in a project's workspace (SVG, DXF, STL, .scad library, …).
 * The OpenSCAD code can reference it by name: `import("logo.svg")`.
 *
 * Uploaded files live in the private Blob store at a content-addressed
 * `blobPath`, so copies (forks, shares, starters) share one stored object.
 * Built-in starter files and rows saved before Blob carry their bytes inline
 * as base64 `data` instead.
 */
export interface WorkspaceFile {
  name: string
  size: number
  addedAt: number
  /** Hex SHA-256 of the bytes. Set on Blob-stored files. */
  sha256?: string
  /** Pathname in the private Blob store. */
  blobPath?: string
  /** Inline bytes, base64-encoded. */
  data?: string
  /** Short-lived signed download URL for `blobPath`. Added when a project is sent to the browser; never stored. */
  url?: string
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
  /** Archived out of the shared library; only its owner still sees it. */
  isPrivate: boolean
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

const DERIVATIVE_SUFFIX = ' — new'

/**
 * Provisional name for a derivative started from a canonical design, before the
 * user has said what they're making of it. Like the placeholder, it gets
 * replaced by an inferred name once the first chat message arrives.
 */
export function provisionalDerivativeName(canonicalTitle: string): string {
  return `${canonicalTitle}${DERIVATIVE_SUFFIX}`
}

/**
 * Whether a project still carries a name nobody chose, so the first chat
 * message may replace it. Returns the base design title for derivatives
 * (`''` for a blank project), or null if the project is already named.
 */
export function provisionalNameBase(name: string): string | null {
  if (name === PLACEHOLDER_PROJECT_NAME) return ''
  if (name.endsWith(DERIVATIVE_SUFFIX)) {
    const base = name.slice(0, -DERIVATIVE_SUFFIX.length).trim()
    return base || null
  }
  return null
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
