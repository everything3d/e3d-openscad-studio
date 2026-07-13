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
  messageCount: number
  updatedAt: number
}

/** Everything the studio needs to open a project. */
export interface FullProject {
  id: string
  name: string
  code: string
  forkedFrom: string | null
  files: WorkspaceFile[]
  createdAt: number
  updatedAt: number
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
