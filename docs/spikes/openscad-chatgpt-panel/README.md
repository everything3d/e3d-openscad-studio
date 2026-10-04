# ChatGPT OpenSCAD wasm spike evidence

See [REPORT.md](REPORT.md) for all seven checks, exact errors, conclusions, scope, and controls.

- [Screenshot](results.jpg), focused on experiment results.
- [Valid-run JSON](panel.json).
- [Console JSON](console.json), including discarded setup attempts.
- [Measured resource CSP metadata](resource-metadata.json).
- [Reproducible source archive](openscad-chatgpt-spike.zip), containing original assets, vendored SDK/loader, exact measured HTML, report, and build/run instructions. Extract it and follow its README. No node_modules, credentials, or Git history are included.

Original local branch: `spike/openscad-chatgpt-panel`; source commit: `a493d93`. This evidence branch is based on studio commit `ae22dac09b934f2375ea4e0482a39e5b4164fdb1`. Only this documentation folder is added; app source is unchanged.
