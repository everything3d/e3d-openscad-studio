# Local acceptance — 2026-09-09

The user requested a usable local implementation with GPT-6 Astra on OpenRouter.
Local Studio runs on `http://127.0.0.1:4318`, using a background Node service and
the user's server-only `OPENROUTER_API_KEY`. Port 4317 is the previous prototype.

## Live evidence

Design: `ec24b230-91fc-4f8e-9fd2-098da979fb72`.

1. GPT-5.6 Terra created `input.scad` and an original `luna_crescent.svg`, producing
   a 70 × 25 × 4 mm two-color plate. Eleven native image-view events were recorded
   across three render revisions. It identified and corrected an SVG-origin error
   and a gap beside the lettering without a corrective user message.
2. Browser feedback placed pin 1 on the crescent. The attachment included the
   frozen screenshot, camera, source hash, and 3D hit position. The model identified
   the crescent from the pin request, reduced it by 25%, and inspected three images.
3. Browser Undo restored source hash
   `885fd020a45d32bf43076c9852afc138245626c234669b569c7e498892ef7c2d`.
4. After a service restart and model switch to `openai/gpt-6-astra`, the same Codex
   conversation resumed. Astra changed only `text("LUNA", …)` to `text("NOVA", …)`.
   Git comparison confirmed the restored crescent and all other source lines were
   preserved. Two native image-view events were recorded. A new edit removed the
   old smaller-crescent redo path.

## Compatibility finding

Codex 0.153.4 plus OpenRouter returned repeated empty `functions.exec` calls. The
requests were interrupted; no design edits were made by those probes. Disabling
code-mode flags did not fix it. The installed older CLI 0.144.6 completed a shell
read and the full CAD workflow, so the project dependency is pinned to 0.144.6.
The temporary flags were removed. No custom tool-execution loop or request proxy
was introduced. A tilde-prefixed model probe returned HTTP 400; the working model
IDs use their normal `openai/...` form.

## Local product checks

- 7 workspace/runtime/HTTP tests, 2 renderer tests, and 12 application tests pass.
- TypeScript and JavaScript syntax checks pass.
- Browser checks cover creation, library, annotation, exact Undo/Redo, comparison,
  draft persistence, desktop/narrow layouts, and visible Astra configuration.
- `npm run studio:local` starts a detached service; a second invocation reuses it.
- Tool details are collapsed under Codex activity; model file links use local
  artifact routes; disconnected state disables sending and reconnects automatically.

## Scope

This acceptance is for trusted local use. Hosted multi-user isolation, backups,
publishing/sharing of filesystem designs, and signed-in browser acceptance of the
Next gateway remain separate work. No public deployment or personal Codex login
was used for these OpenRouter checks.
