# OpenSCAD wasm / ChatGPT MCP App spike

**Key result: PASS.** On 5 October 2026 at 01:46 IST, Chrome 154 on macOS ran E3D's real OpenSCAD WebAssembly in a blob Worker inside ChatGPT's sandboxed MCP App iframe. `WebAssembly.instantiateStreaming` succeeded in **37.2 ms**, returning 30 exports. The Emscripten loader completed initialization. No `wasm-unsafe-eval` / `unsafe-eval` refusal occurred.

Stopped immediately after definitive Check 2, per the brief. Checks 4–7 are intentionally untested; no compile timings are claimed.

| Check | Result | Evidence / exact error |
|---|---|---|
| 1. Worker | **PASS — A blob** | Ready handshake received. No error in valid run. B was not needed. |
| 2. wasm instantiate | **PASS** | `WebAssembly.instantiateStreaming`, 37.200000047683716 ms, 30 exports; no error. |
| 3. Download | **PASS for actual binary; 16 MB untested** | 9,603,115 bytes received. No cap/timeout encountered. Current upstream binary is 9.16 MiB, not 16 MB. |
| 4. Geometry compile; cold/warm | **NOT RUN** | Stopped after Check 2. Cold compile and warm recompile timings unavailable. 37.2 ms is instantiation only. |
| 5. fonts.gstatic.com | **NOT RUN** | Stopped after Check 2. Bundled fonts.zip loaded during initialization; this does not establish external font fetch support. |
| 6. Persistence after UI-less ping | **NOT RUN** | No ping invoked. |
| 7. Model context token | **NOT RUN** | Token not sent or queried. |

**Outcome:** The CSP-blocked/server-side fallback is unnecessary for this observed host configuration. Blob Workers and wasm initialization work. The full client-side outcome is promising but not fully established under the brief's own “Checks 1–4 pass” rule, because Check 4 was intentionally skipped. None of the other fallback conditions was observed. Do not claim all seven checks passed.

## Scope and controls

- Tested in a real signed-in ChatGPT conversation using the E3D OpenSCAD Spike personal plugin.
- “Enforce CSP for custom apps” was enabled and verified before the valid run; it remains enabled. No unsafe-eval CSP relaxation was added.
- Resource `_meta.ui.csp`: asset tunnel in resourceDomains and connectDomains; fonts.gstatic.com additionally in connectDomains. A declared thread entrypoint was registered. The observed execution surface was an **inline MCP App iframe** in the conversation; separate conversation-side-panel lifetime was not tested.
- The original wasm and fonts.zip were reused. A streaming hook passes the original Emscripten import object to `instantiateStreaming`, using a Response wrapping fetched/cached wasm bytes with application/wasm MIME. This proves wasm instantiation under iframe/Worker policy; it does not measure network streaming overlap.
- Setup attempt discarded: an overbroad origin replacement caused `Error: Uncaught SyntaxError: Unexpected string` in A. Fixed before the valid run, and resource URI bumped from `ui://e3d/spike.html` to `ui://e3d/spike-v2.html` to avoid cached HTML. Console evidence retains these attempts, clearly distinguishable by mount UUID. Valid mount: `318c3340-6655-41e5-aff0-683899cff654`.
- During that discarded attempt, B reported: `SecurityError: Failed to construct 'Worker': Script at 'https://anthony-consider-senate-places.trycloudflare.com/spike-worker.js?origin=https%3A%2F%2Fanthony-consider-senate-places.trycloudflare.com' cannot be accessed from origin 'https://mcp-app-760240397687df66eba3b3b9430968b7f116d96fe6c030b3.web-sandbox.oaiusercontent.com'.` ASSET_ORIGIN is cross-origin to ChatGPT's iframe; B must not be described as a same-origin Worker.

## Deliverable

Published evidence branch: `spike/openscad-chatgpt-panel` in `everything3d/e3d-openscad-studio`. Original local spike commit: `a493d93`. Reproduction instructions: [README](README.md). Raw valid-run results: [panel.json](panel.json). Console: [console.json](console.json). [Screenshot](results.jpg).

Upstream revisions: mcp-extensions `ca16cb3bc015baaa1b849082d8755bbef18770cb`; e3d-openscad-studio `ae22dac09b934f2375ea4e0482a39e5b4164fdb1`.

The optional remaining-checks button is provided for a later extension of the experiment. It was not clicked. Post-measurement code changes only improve that optional path (fresh Worker for cold timing, separate STL export, SVG output for 2D text); the measured key-probe path is unchanged.

Documentation used: [plugin extensions](https://developers.openai.com/plugins/build/extensions), [MCP App UI/CSP](https://developers.openai.com/plugins/build/chatgpt-ui), [connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt). These describe setup, not experimental proof of wasm support.

Cleanup: both temporary HTTPS tunnels and local servers were stopped after evidence capture. The personal test plugin remains installed; its temporary MCP endpoint is offline. CSP enforcement remains enabled. Restart with new tunnels and update the plugin URL to rerun. Final Git commit: see `git log -1` (evidence and source are committed).
