/**
 * Command line for one OpenSCAD render. Shared by the render worker and the
 * built-in starter render test, so the test exercises exactly what users get.
 */
export function openscadArgs(format: string, input = '/input.scad', output = '/output.dat'): string[] {
  return [
    input,
    // Manifold backend: robust against the almost-degenerate geometry CGAL
    // rejects, and the only one that emits per-face colors in OFF output.
    '--backend=manifold',
    // textmetrics() is still flagged experimental in this build. Without the
    // flag it returns undef and every metric-derived layout (the built-in
    // starters included) silently collapses.
    '--enable=textmetrics',
    `--export-format=${format}`,
    '-o',
    output,
  ]
}
