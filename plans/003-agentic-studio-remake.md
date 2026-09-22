# Agentic Studio remake

Branch: `codex/agentic-studio`. Started 2026-09-06.

## Product contract

OpenSCAD and arbitrary supporting assets remain authoritative. Codex owns the
agent loop, intelligence, editing tools, asset creation, and visual inspection.
E3D owns visible state, graphical input, reproducible artifacts, exact history,
and export. External agents use the same human-facing controls through computer use.
No parameter extraction, CAD operation catalog, custom model/tool loop, or source
rewriting in response to natural language.

## Implementation sequence

1. **Isolate inference and verify OpenRouter** — application-owned Codex home and
   configuration, server-only OpenRouter key, explicit model, no fallback to personal
   ChatGPT credentials. Verify actual file edits, image input/viewing, continuation,
   cancellation and errors. Missing credentials must leave the viewer usable.
2. **Durable workspace and history** — use Git for whole-project checkpoints;
   persist feedback separately; one requested design change per undo step. Capture
   interrupted/failed edits, recover after restart, serialize mutations, preserve
   redo until a new edit, and tell Codex when files were restored.
3. **Workspace interface** — explicit Undo/Redo, scoped Cmd/Ctrl+Z, Stop, before/after
   with fixed camera, persistent feedback and numbered pins, editable annotations,
   save/reopen and duplication, ordinary asset import/source bundle export.
4. **Product integration** — connect the new workspace to the existing project and
   starter entry points. Keep the old path available while porting; do not mutate
   existing saved projects or schemas merely to test the remake. Persistent local
   runtime is a real hosting requirement; do not pretend it runs in short-lived
   serverless functions. Cloud deployment is a subsequent explicit deployment task.
5. **Acceptance and cleanup** — real OpenRouter end-to-end run, state/history failure
   tests, desktop/narrow browser testing, regression tests/typecheck. Document exact
   completion and remaining integration/hosting gaps.

## Current status (2026-09-09)

- Branch created; all pre-existing uncommitted work preserved.
- Milestone 1: real OpenRouter tool execution, SVG/SCAD creation, render inspection,
  screenshot feedback, and continuation after undo/restart verified. Codex pinned
  to 0.144.6 after the newer release returned empty tool calls. The user-selected
  default is now GPT-6 Astra. Credentials remain outside source and browser state.
- Milestone 2: Git-backed whole-project history, redo behavior, pending-operation
  recovery, mutation serialization, and restored-revision context implemented.
- Milestone 3: new workspace UI implemented with scoped keyboard undo/redo, Stop,
  fixed-camera comparison, movable numbered pins, stroke undo/redo, draft persistence,
  project selection/new/rename/duplicate, imports, source ZIP and 3MF exports.
- Milestone 4: `/studio` now hosts the new interface through an authenticated gateway;
  old interface retained at `/studio/legacy`. Existing project links import their
  source/files; library imports make independent copies. New filesystem workspaces
  do not yet support publishing starters or sharing through the old database flows.
- Milestone 5: 7 workspace/runtime/HTTP tests, 2 renderer tests, and 12 app tests pass.
  TypeScript and syntax checks pass. Browser verified numbered pins, annotation
  Cmd+Z, reload persistence of marked feedback/text, multi-file import, before/after,
  whole-design Cmd+Z and Redo, the starter library, and desktop/narrow layouts.
  Service restart preserved the design, history, and feedback draft. Source ZIPs
  export a single Git checkpoint; the HTTP acceptance test passes after this change.
  The Next app reaches its expected Clerk sign-in gate;
  a signed-in end-to-end test is still pending. No cloud deployment performed.

Read [studio/README.md](../studio/README.md) for operation and boundaries, and
[live acceptance](../studio/ACCEPTANCE.md) for evidence. The latest user scope is a
finished local workspace: it runs in the background via `npm run studio:local` on
port 4318, with Astra selected. Hosted publishing/sharing and signed-in acceptance
remain outside this local release; do not call the full hosted remake complete.

## Verification rules

Do not claim a model saw a render without an image-view event. Do not claim provider
compatibility from initialization alone. History tests must include supporting-file
creation/deletion, redo invalidation, failed/interrupted edits, and restart recovery.
Undo is exact restoration, not an instruction asking the model to reverse an edit.
Never expose credentials in the browser, logs, workspace, source exports, or commits.

## Preserved work at branch creation

The tree already contained modified README, package/lockfile, plan index, database
queries, and untracked instruction files, canonical assets/source/tests, and the
prototype. None were discarded or silently committed. This plan supersedes the
custom-harness ordering of plan 002.

## User feedback — 2026-09-11

Deferred UI changes: add text attached to individual marks/pins (for example,
draw a dimension line and enter "50 mm" beside it); add a file viewer/editor for
manual SCAD and supporting-file edits with normal workspace history.

Urgent cost issue: the configured OpenRouter key has no key-specific spending cap.
No inference was performed while investigating this report, and all listed local
workspaces were idle. Add explicit spending controls and usage visibility before
further autonomous paid acceptance tests. Key-level totals alone do not attribute
charges to individual tests or application requests.
