# Codex CAD prototype

A separate, local experiment in making E3D a graphical frontend for the existing
Codex harness. There is no app-owned model loop, tool registry, patch interpreter,
SVG tool, or conversation database. Designs remain ordinary code and assets.

## Run

Requires Node 24+ and a Codex login on this machine.

```sh
npm install
npx codex login  # only if not already logged in
npm run prototype
```

Open http://127.0.0.1:4317. The project currently pins Codex CLI 0.144.6 for the new
Studio's OpenRouter compatibility (the original prototype was tested with 0.153.4); `npm run prototype`
uses that copy, not an older globally installed CLI. It inherits your configured
Codex model, login, skills, and available integrations. It uses normal Codex usage.
`CODEX_BIN` can explicitly select another CLI binary.

The default design directory is `~/.e3d-codex-prototype/workspace`. Restarting resumes
the same Codex thread and design. `CAD_DATA_DIR=/absolute/path` selects a different
project container; its `workspace/` holds files and `session.json` holds only the
Codex thread ID. `CAD_PORT` changes the local port. Run one server per data directory.
The existing Next.js application and its saved projects are independent of this
experiment. Copy a design and its assets into the prototype workspace to try it.

## The entire architecture

```text
Browser: conversation, 3D viewport, reference images, draw/pin feedback
  │ text + ordinary image attachments           ▲ events + rendered artifacts
  ▼                                             │
Local Node server ── JSON-RPC over stdio ── codex app-server
                                               │
                              existing shell / patch / image tools
                                               │
                                     ordinary design directory
                                               │
                              OpenSCAD skill + render command
                                               │
                                  mesh + PNGs + 3MF + diagnostics
```

| Part | Responsibility |
| --- | --- |
| `codex.mjs` | Generic request/response transport and event forwarding. Codex owns reasoning, tools, file edits, history, and compaction. |
| `server.mjs` | One local project, session connection, image uploads, event stream, artifact serving. No source code inserted into prompts. |
| `app.js`, `index.html`, `style.css` | Present conversation and geometry; capture graphical input. |
| `skills/openscad-studio/SKILL.md` | Teach the edit → render → inspect → fix workflow, plus font/SVG guidance. |
| `render.mjs`, `rasterize.mjs` | Deterministic build utility: existing vendored OpenSCAD WASM, existing OFF parser and 3MF exporter, plus inspection PNGs. |

The renderer is an ordinary command, invoked through Codex's existing shell tool:

```sh
node "$E3D_CAD_RENDERER" input.scad --views top,front,right,iso
```

It mounts ordinary SCAD/SVG/assets from the project and registers project TTF/OTF
files. It publishes immutable outputs under `.renders/` and a `latest.json` manifest.
The viewport loads that mesh. The skill asks Codex to open the resulting PNGs with
its existing image tool and fix visible problems. The app does not interpret
assistant prose, manufacture a tool call, or force an additional model turn.

Visual inspection is skill-guided, not a hard runtime guarantee. Live tool events
show “Inspected an image”; compiler diagnostics and PNGs are also available to the
human. PNGs use the same mesh as the viewport, with orthographic views and simpler
lighting. They are useful for geometry inspection, not photorealistic previews.

“Mark a change” freezes the current viewport. Draw a stroke or click a pin, then
“Add to message” and describe the change. The flattened image goes to Codex as a
normal local image, alongside the render revision and camera. The app captures the
input; Codex decides what it means and how to modify the design. Marks are screen
references, not face IDs or constraints. You can also attach reference PNG/JPEGs.

## Boundaries of this experiment

- One local project and conversation; no project manager, cloud hosting, accounts,
  collaboration, or edit-history UI. Codex persists the conversation itself.
- Runs with Codex's workspace-write sandbox and approval policy `never`. Interactive
  approval requests are declined; operations requiring extra permissions must be
  addressed through normal Codex configuration/client work. Network access is
  restricted by this sandbox default, so external asset services are not proven by
  this test. The reusable SVG case needs only ordinary file tools.
- Source fingerprints prevent stale/failed renders from being presented as current
  exports. The last visible mesh can remain while a build is broken. Both compiler
  exit failures and `ERROR:` diagnostics invalidate the latest manifest.
- Rendering currently includes non-hidden project files, excludes symlinks and
  `node_modules`, and limits the workspace snapshot to 64 MB. Assets must live inside
  the workspace. The app polls local artifacts; it never sends that snapshot as
  model context.
- 3MF keeps the existing app's per-face color representation. Slicer mapping and
  physical printability need separate verification.
- Live tool activity is streamed. On reload, history comes from Codex's thread API;
  that API can omit past command/image items. The app has no second event database.
- Bound to loopback with local origin/host checks. This is not a multi-user service.

## Verification

```sh
npm run test:prototype
npm test
npx tsc --noEmit --incremental false
```

The prototype tests compile a project with a supporting SCAD module and SVG, verify
dimensions/colors/3MF/PNG output, exercise failed include-file builds and stale
fingerprints, and check image depth occlusion. They make no model calls.

Live acceptance testing uses the real Codex connection: ask for a Maya plaque and
a newly created reusable smiling-sun SVG; confirm rendered images are opened; then
send a marked viewport asking for coral lettering with 2 mm relief. This exercises
arbitrary assets, visual inspection, graphical input, and session continuation.

Verified on 2026-09-06 with the configured `gpt-6-astra` model: both modeling turns
completed, each emitted two image-view events, and the marked feedback produced a
90 × 32 × 5 mm model with separate 2 mm letter relief and unchanged 1 mm sun relief.
Server restart restored the same conversation and attached screenshot. Desktop and
narrow layouts were inspected; the browser reported no console errors.
