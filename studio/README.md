# Agentic Studio

Implementation plan: [003-agentic-studio-remake](../plans/003-agentic-studio-remake.md).
This is the new workspace on branch `codex/agentic-studio`. It retains the prototype's
ordinary OpenSCAD render command and Codex transport; the new code owns project state
and interaction, not an agent loop.

## Run

Node 24+, Git, and `npm install` are required. Configure the server environment in
`.env.local` (never in a `NEXT_PUBLIC_` variable):

```dotenv
OPENROUTER_API_KEY=your-key
STUDIO_MODEL=openai/gpt-6-astra
```

- `npm run dev`: open `/studio`. Clerk authentication protects this route and its
  gateway. The persistent workspace service starts automatically on loopback.
- `npm run studio`: open http://127.0.0.1:4318 for local development without Clerk.
  This uses a separate `local` workspace namespace. It does not grant access to the
  signed-in users' namespaces.
- `npm run studio:local`: starts the same service in the background so it survives
  the terminal/task ending. Running it again reuses the service. Logs are stored in
  `~/.e3d-studio/service.log`. This does not install a login/startup service.
- `/studio/legacy` retains the previous interface during migration.
- `E3D_PORT` changes the service port; `E3D_DATA_DIR` changes the data directory
  (default `~/.e3d-studio`). One server owns each data directory. Restart the service
  after editing its code or environment. `CODEX_BIN` overrides the project-pinned CLI.

A missing key leaves project viewing, imports, history and exports working. It does
not fall back to a personal Codex/ChatGPT login. The standalone service and Next.js
must use the same `E3D_DATA_DIR` and `E3D_PORT` when run together.

## Architecture

- `runtime.mjs`: explicit OpenRouter provider and model configuration; a separate
  Codex home for each workspace. Inference credentials go only to the runtime,
  excluding unrelated app/database credentials. The shell environment excludes the
  inference key. Model turns use native Codex tools and our existing skill.
- `workspace.mjs`: request lifecycle, feedback references and result summaries;
  finalizes history after successful, failed or interrupted model turns. Codex owns
  the actual conversation. Restored checkpoint identity is included in the next
  request so earlier conversation cannot silently define the current design.
- `history.mjs`: ordinary Git trees/commits stored outside the agent's design folder.
  Whole-project snapshots include supporting assets and deletions. One request makes
  one undo step. New actual edits replace redo; no-op requests preserve it. Pending
  operations and restores are journaled for recovery.
- `build.mjs`: invokes the same renderer in a separate process to keep HTTP/UI events
  responsive during compilation.
- `server.mjs`: loopback HTTP/artifacts/events, projects, imports, source ZIPs and
  owner namespaces. The Next gateway adds an application token and authenticated
  owner; browser-provided owner headers are not trusted.
- `web/`: one browser interface for both people and computer-use agents. Explicit
  Undo/Redo/Stop, fixed-camera before/after, numbered movable pins with optional 3D hit positions, strokes with
  annotation undo/redo, reference images, saved browser drafts, project duplication,
  source/3MF exports and measured overall dimensions.
- `src/app/api/workbench/[...path]/route.ts`: authenticated Next gateway. Library
  imports read existing projects/starters and create independent workspace copies.
  Existing database projects are not rewritten by the new workspace.

## Files and persistence

Each owner/project has `files/` containing `input.scad` and arbitrary supporting
assets, `history/` containing Git snapshots, `requests.json` containing feedback and
outcomes, and `agent/runtime/` containing Codex's configuration/session storage.
The application metadata lives outside the design directory and source exports.

Rendering/feedback/skill infrastructure and environment files are excluded from Git
snapshots. Render builds currently include non-hidden regular files and exclude symlinks
and `node_modules`. Source ZIPs use `git archive` of the selected checkpoint, so
exports cannot contain a mix of files from an in-progress edit. Imports reject hidden and parent paths and
symlink traversal. Use self-contained project folders. Source exports contain the
editable design; 3MF contains the current rendered model. A failed or stale render
cannot be exported as the current 3MF from the UI.

Cmd/Ctrl+Z has scope: text fields keep native text undo, annotation mode undoes a
mark, and the workspace restores a design checkpoint. Shift+Cmd/Ctrl+Z and Ctrl+Y
redo. Stop applies to a model request; interrupted file edits become recoverable
history. Moving the camera is separate from design history. Before/after is
read-only and keeps the viewpoint steady. Browser drafts are stored per project;
very large drafts can exceed browser storage and display a warning.

## Deployment and remaining validation

This implementation requires a persistent Node process and local durable storage.
It is not a Vercel/serverless deployment. API owner separation is tested, but the
Codex workspace-write sandbox permits broad filesystem reads: **a shared host is
not an adequate security boundary for untrusted hosted users**. Production requires
separate filesystem/process isolation for execution and private storage, along with
backup/recovery and service supervision. The local developer UI deliberately trusts
the person using the machine. The local service is hosted on loopback; no public
deployment has been performed.

Live OpenRouter acceptance passed on 2026-09-09. GPT-5.6 Terra created a SCAD/SVG
nameplate, inspected its own renders, corrected an SVG placement error, and applied
a screenshot pin requesting a smaller crescent. After undo and a service restart,
GPT-6 Astra changed only the requested lettering and inspected the new renders,
preserving the restored geometry. The selected model is now `openai/gpt-6-astra`.
Live interruption stopped the earlier compatibility probes; partial-edit recovery
is covered by the lifecycle tests. A separate invalid-model probe returned a
provider error. See [the acceptance record](./ACCEPTANCE.md).

Codex CLI is pinned to **0.144.6**: 0.153.4 returned repeated empty function calls
through OpenRouter in the live test. Pin upgrades must repeat real tool/image tests.
Provider settings are loaded from the isolated `config.toml` before app-server
initialization. Command-based auth obtains the key from the runtime environment;
the key is never written into that configuration file.

The new `/studio` entry and library gateway are implemented; authenticated browser
acceptance requires signing in. Publishing new starters, sharing new filesystem
workspaces, server backups, and richer measurement are remaining product work.
The legacy interface still operates on its existing database copies; it does not
reflect subsequent edits in a new filesystem workspace.

## Checks

```sh
npm run test:studio
npm run test:prototype
npm test
npx tsc --noEmit --incremental false
```

Tests cover exact undo/redo of binary assets and deletions, redo invalidation/no-op
preservation, interrupted-request recovery, credential configuration, real HTTP
import/render/restore/export, API owner separation, authentication and cross-origin
write rejection. Rendering tests verify color/geometry/image/export consistency and
compiler errors that would otherwise produce partial geometry. These tests make no
paid model calls.
