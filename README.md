# E3D OpenSCAD Studio

An AI-powered [OpenSCAD](https://openscad.org/) editor with live 3D preview, running
entirely in the browser. You describe what you want in a chat; the AI writes the
OpenSCAD code; it renders to a 3D model in real time. Every chat is a project, and
any project can be forked to branch a new idea.

## Features

- **AI-first workflow** — the main way you interact is the chat. The AI writes and
  edits the OpenSCAD program for you, always returning the full source so it can be
  rendered directly.
- **Live 3D preview** — OpenSCAD compiles to an STL in a Web Worker (via
  `openscad-wasm`, real OpenSCAD compiled to WebAssembly), rendered with three.js.
  Renders are ~100 ms for typical models and update as you type.
- **Editable code** — a CodeMirror editor with OpenSCAD syntax highlighting. Edit the
  code by hand and the preview re-renders automatically.
- **Projects = chats** — each project holds its own conversation history and code,
  saved in your browser's local storage.
- **Fork** — clone any project (code + history) into a new one that remembers its
  ancestor, so you can explore variations without losing the original.
- **100% browser-based** — no backend. Statically deployable to any host.

## How it works

```
You (chat)  ──▶  AI (OpenAI-compatible API)  ──▶  OpenSCAD source
                                                       │
                              CodeMirror editor ◀───────┤
                                                       ▼
                          openscad-wasm worker  ──▶  binary STL  ──▶  three.js preview
```

- The AI is reached through any **OpenAI-compatible `/chat/completions` endpoint**
  (OpenAI, Inception Labs, a local server, …). Configure the base URL, API key, and
  model in **Settings**. The key is stored only in your browser's local storage and
  sent directly to the endpoint you configure.
- OpenSCAD runs as WebAssembly in a Web Worker, so compilation never blocks the UI. A
  fresh instance is created per render because the wasm build runs `main()` once per
  instance.

## Getting started

```bash
npm install
npm run dev      # start the dev server (Vite)
```

Open the printed URL, then click **Settings** and enter:

- **API base URL** — e.g. `https://api.openai.com/v1`
- **API key** — your key for that endpoint
- **Model** — e.g. `gpt-4o-mini`

Now describe a model in the chat ("a hexagonal phone stand", "a 20 mm gear with 12
teeth") and watch it render.

### Build

```bash
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Tech stack

- **Vite + React + TypeScript**
- **openscad-wasm** — OpenSCAD compiled to WebAssembly
- **three.js** — STL rendering (STLLoader + OrbitControls)
- **CodeMirror 6** — code editor with a custom OpenSCAD language mode

## Notes & limitations (v0.1)

- Persistence is local to the browser (localStorage). Clearing site data removes your
  projects. Cloud sync / accounts are not implemented yet.
- The API key lives in the browser and is sent directly to your configured endpoint —
  appropriate for personal / self-hosted use. For a shared deployment you'd add a
  server-side proxy.
- Responses are non-streaming; the AI must return the complete program each turn.
