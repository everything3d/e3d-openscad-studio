# E3D OpenSCAD Studio

An AI-powered [OpenSCAD](https://openscad.org/) editor with live 3D preview. You
describe what you want in a chat; an AI agent writes the OpenSCAD code; it renders
to a 3D model in real time. Every chat is a project, and any project can be forked
to branch a new idea.

## Features

- **AI-first workflow** — the main way you interact is the chat. A typed agent tool
  (`writeOpenscad`) replaces the project source with a complete program every turn,
  so the model is always renderable.
- **Live 3D preview** — OpenSCAD compiles to an STL in a Web Worker (real OpenSCAD
  compiled to WebAssembly, Manifold backend), rendered with three.js. Renders update
  as you type.
- **Colors & export** — `color()` renders in the live preview (per-face colors via
  OpenSCAD's colored OFF export). Download models as binary STL or as 3MF with
  colors preserved as materials (written client-side) for multi-material slicing.
- **Editable code** — a CodeMirror editor with OpenSCAD syntax highlighting. Edit the
  code by hand and the preview re-renders automatically.
- **Projects = chats** — each project holds its conversation history, code, and
  workspace files (SVG/DXF/STL/`.scad` libraries), persisted in Postgres.
- **Fork** — clone any project (code + history + files) into a new one that remembers
  its ancestor.

## Architecture

```
Browser                              Server (Next.js App Router)
───────                              ───────────────────────────
Chat (useChat + AI Elements)  ──▶    POST /api/chat
                                       └─ ToolLoopAgent (AI SDK)
                                          ├─ model: openai/gpt-5.6-terra (AI Gateway)
                                          ├─ tool: writeOpenscad (zod-typed)
                                          └─ onFinish → persist chat + code (Drizzle/Postgres)
writeOpenscad tool part  ──▶  editor + preview
CodeMirror editor        ──▶  PATCH /api/projects/[id]
openscad-wasm worker     ──▶  binary STL  ──▶  three.js preview
```

- **AI**: [AI SDK](https://ai-sdk.dev) `ToolLoopAgent` behind an API route, using the
  [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (`openai/gpt-5.6-terra`).
  No API keys in the browser — deployments on Vercel authenticate via OIDC.
- **Chat UI**: [AI Elements](https://elements.ai-sdk.dev) (shadcn/ui-based components)
  with `useChat` streaming.
- **Persistence**: Postgres via Drizzle ORM (`projects`, `messages` as AI SDK
  UIMessages, `workspace_files`).
- **Rendering**: OpenSCAD wasm (vendored snapshot with the Manifold geometry backend)
  in a Web Worker; wasm + font bundle served from `public/openscad/`.

## Getting started

Requirements: Node 20+, Postgres running locally.

```bash
npm install
createdb e3d_openscad_studio

cp .env.example .env.local
# Set POSTGRES_URL (e.g. postgres://<you>@localhost:5432/e3d_openscad_studio)
# Set AI_GATEWAY_API_KEY (create one at https://vercel.com/~/ai-gateway/api-keys)

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
npm run typecheck    # tsc --noEmit
npm run db:generate  # generate migration from schema changes
npm run db:migrate   # apply migrations
```

## Deploying to Vercel

1. Add a Postgres database (e.g. Neon) from the Vercel Marketplace — it provisions
   `POSTGRES_URL` automatically.
2. AI Gateway auth is automatic on Vercel (OIDC); no key needed.
3. Run migrations against the production database: `POSTGRES_URL=... npm run db:migrate`.

## Tech stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **AI SDK v7** (`ToolLoopAgent`, `useChat`) + **AI Elements** + **shadcn/ui** + Tailwind v4
- **Drizzle ORM + Postgres**
- **openscad-wasm** — OpenSCAD compiled to WebAssembly (Manifold backend)
- **three.js** — STL rendering (STLLoader + OrbitControls)
- **CodeMirror 6** — editor with a custom OpenSCAD language mode
