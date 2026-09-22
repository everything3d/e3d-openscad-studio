---
name: openscad-studio
description: Create and modify printable OpenSCAD designs in the E3D studio workspace, including supporting SVGs and SCAD files, and inspect rendered geometry before reporting the result.
---

# OpenSCAD studio

The current directory is the user's design. `input.scad` is the entrypoint. Use your
ordinary file, patch, shell, and image tools. You can create any useful supporting
files or generate assets yourself; the application does not restrict design changes
to predefined parameters or operations. Preserve unrelated user work.

## Render and see

Run this ordinary local utility from the workspace:

```sh
node "$E3D_CAD_RENDERER" input.scad
```

It runs the studio's vendored OpenSCAD/Manifold build, mounts workspace assets,
and creates a colored OFF mesh, 3MF, top/isometric PNGs, and diagnostics under
`.renders/`. It prints absolute image paths. **Open the resulting PNGs using your
image-viewing tool** to check the change before finishing. Reading the filenames
or compiler success alone is not visual inspection. Fix visible mistakes and render
again as needed; explain any unresolved render or inspection problem.

Request other views with `--views top,front,right,iso`. Images use the same geometry
as the browser viewer; they are orthographic inspection renders. Front looks along
negative Y; top looks down Z. Choose views that show the requested feature. Batch
related file edits before rendering. The app displays the latest published render.

The utility reports compiler errors, warnings, measured bounds in mm, and palette.
It is not a slicer or a proof of printability. You may use OpenSCAD `assert()` and
`echo()` to check dimensions or assumptions. Do not edit the renderer or `.renders`
outputs to disguise a problem in the design.

## Geometry and assets

Use `color()` for printable color regions. The 3MF retains the current studio's
per-face color representation. Alpha is not supported. Keep fitted parts, print
orientation, and intentional separated pieces intact unless asked to change them.

Text defaults to Liberation Sans (Bold is bundled); Liberation Serif/Mono, Noto Sans,
Spicy Sale, Baby Donuts and additional display fonts are bundled. See
`$E3D_FONT_CATALOG` for the bundled family list if needed. For a new font, obtain a
suitable TTF/OTF through your available tools and put it in the workspace; the renderer
registers local TTF/OTF files. This prototype does not automatically fetch Google Fonts.

For emoji/icons, choose geometry, a closed-path SVG, or a font with confirmed glyph
support. A Unicode emoji string does not guarantee a printable glyph. You can write
or modify SVGs directly and import/extrude them. Use available external services only
when the task needs them; no special SVG tool is required by this studio.

## Feedback

The user can attach images and draw on a captured view. Feedback metadata identifies
the rendered revision and camera. Inspect the image and use the source to implement
the intended change. A screen-space mark is a reference, not a geometric constraint.
If it refers to an older render, account for changes made since then.

Finish with a brief description of the change and what you inspected. Ordinary
follow-up edits continue in the same Codex session. Keep design knowledge in code,
comments, or concise project notes when useful; do not depend on the UI to parse
your prose into geometry.
