# E3D OpenSCAD Studio

An AI-powered [OpenSCAD](https://openscad.org/) editor with live 3D preview. Choose
a canonical design (or begin blank), then describe what you want in an independent
derivative workspace. An AI agent writes the OpenSCAD code and renders the model in
real time.

## Features

- **AI-first workflow** — the main way you interact is the chat. A typed agent tool
  (`writeOpenscad`) replaces the project source with a complete program every turn,
  so the model is always renderable.
- **Live 3D preview** — OpenSCAD compiles to an STL in a Web Worker (real OpenSCAD
  compiled to WebAssembly, Manifold backend), rendered with three.js. Renders update
  as you type.
- **Colors & export** — `color()` renders in the live preview (per-face colors via
  OpenSCAD's colored OFF export). Download models as binary STL or as 3MF with
  per-face colors preserved as a 3MF color group (written client-side), which
  Bambu Studio, Orca, and PrusaSlicer map to filaments for multi-material printing.
- **Editable code** — a CodeMirror editor with OpenSCAD syntax highlighting. Edit the
  code by hand and the preview re-renders automatically.
- **Canonical design library** — reusable, versioned canonical designs hold code, files,
  descriptions, previews, and design-specific instructions for the agent. They do
  not contain chat history.
- **Independent derivative workspaces** — creating a derivative copies the canonical's
  current code and files into an independent workspace with an empty chat. Blank
  designs remain available too.
- **Save as canonical** — distill a derivative workspace into reviewed reusable metadata,
  then create a shared canonical or publish a new immutable version without copying the
  conversation. Only the creating account can maintain that canonical.
- **Workspace fork** — clone an in-progress workspace (code + history + files) when
  you intentionally want to branch the same conversation.
- **Share** — create a revocable link to a frozen project snapshot. Another signed-in
  user can open the link as a private, independently editable copy with the full
  conversation, source, and workspace files.

## Architecture

```
Browser                              Server (Next.js App Router)
───────                              ───────────────────────────
Chat (useChat + AI Elements)  ──▶    POST /api/chat
                                       └─ ToolLoopAgent (AI SDK)
                                          ├─ model: openai/gpt-5.6-terra (OpenRouter)
                                          ├─ tool: writeOpenscad (zod-typed)
                                          └─ onFinish → persist chat + code (Drizzle/Postgres)
writeOpenscad tool part  ──▶  editor + preview
CodeMirror editor        ──▶  PATCH /api/projects/[id]
openscad-wasm worker     ──▶  binary STL  ──▶  three.js preview
```

- **AI**: [AI SDK](https://ai-sdk.dev) `ToolLoopAgent` behind an API route, routed
  through [OpenRouter](https://openrouter.ai) (`openai/gpt-5.6-terra` by default).
  Model ids are configured in one place, `src/lib/ai/openrouter.ts`, and overridable
  per environment via `STUDIO_MODEL` / `NAMING_MODEL` — any id from
  [openrouter.ai/models](https://openrouter.ai/models) that supports tool calling and
  image input. `STUDIO_MODEL_FALLBACKS` adds a routing chain OpenRouter falls through
  when the primary model is unavailable. All calls are server-side; no API keys
  reach the browser.
- **Chat UI**: [AI Elements](https://elements.ai-sdk.dev) (shadcn/ui-based components)
  with `useChat` streaming.
- **Persistence**: Postgres via Drizzle ORM (`canonical_designs`, immutable
  `canonical_versions`, mutable `projects`, AI SDK `messages`, and `workspace_files`).
- **Rendering**: OpenSCAD wasm (vendored snapshot with the Manifold geometry backend)
  in a Web Worker; wasm + font bundle served from `public/openscad/`.

## Getting started

Requirements: Node 20+, Postgres running locally.

```bash
npm install
createdb e3d_openscad_studio

cp .env.example .env.local
# Set POSTGRES_URL (e.g. postgres://<you>@localhost:5432/e3d_openscad_studio)
# Set OPENROUTER_API_KEY (create one at https://openrouter.ai/settings/keys)

npm run db:migrate   # apply schema
npm run dev          # http://localhost:3000
```

Describe a model in the chat ("a hexagonal phone stand", "a 20 mm gear with 12
teeth") and watch it render.

### Scripts

```bash
npm run dev          # dev server (Turbopack)
npm run build        # type-check + production build
npm run start        # serve production build
npm test             # focused domain regression tests
npm run typecheck    # tsc --noEmit
npm run db:generate  # generate migration from schema changes
npm run db:migrate   # apply migrations
```

## Deploying to Vercel

1. Add a Postgres database (e.g. Neon) from the Vercel Marketplace — it provisions
   `POSTGRES_URL` automatically.
2. Add `OPENROUTER_API_KEY` under Project → Settings → Environment Variables
   (Production, Preview, and Development), then redeploy so it takes effect.
3. Run migrations against the production database: `POSTGRES_URL=... npm run db:migrate`.
4. Canonical designs form a shared library for every signed-in user. Their owner
   remains the only account that can edit, version, or archive them.

## Canonical and derivative workflow

Opening `/studio` shows the canonical design library rather than automatically
reopening the latest derivative. Choose **Blank design** or inspect a canonical and
select **Create derivative**. A derivative records the exact canonical version it
came from; new canonical versions appear as a non-destructive update hint while
existing work continues unchanged.

Use **Save as canonical** in a workspace to draft a title, description,
reusable-change summary, and agent guidance. Review any derivative-specific warnings
before saving. Publishing snapshots only the current code and workspace files —
messages never become part of a canonical design.

## Tech stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **AI SDK v7** (`ToolLoopAgent`, `useChat`) + **AI Elements** + **shadcn/ui** + Tailwind v4
- **Drizzle ORM + Postgres**
- **openscad-wasm** — OpenSCAD compiled to WebAssembly (Manifold backend)
- **three.js** — STL rendering (STLLoader + OrbitControls)
- **CodeMirror 6** — editor with a custom OpenSCAD language mode
