# Lighthouse image comparison

Both models received the original lighthouse-unilever.png and this exact prompt:

> Make a 3d printable version with appropriately split parts (golden and white). ignore the unilever logo. Total height 250mm

Used the main-branch studio agent, default reasoning and tools, no model fallbacks, one attempt per model, and the production route's 120-second timeout. No corrections or follow-up prompts were sent. Original generated SCAD files are unchanged.

| Model | Full response | Provider-reported cost | Nominal height |
| --- | ---: | ---: | ---: |
| Muse Spark 1.3 Contributor | 113.26 s | $0.00115272 | 253 mm |
| GPT-5.6 Terra | 18.82 s | $0.0253679 | 250 mm |

Both original programs compile. Mesh heights are slightly below nominal because the spherical finials are polygonal approximations.

Muse made a hollow tower, through-windows, and five individually named part modules: gold base, white tower, gold deck/frame, clear sleeve, gold roof. It added clear material beyond the requested gold/white split. The finial center is at 247 mm and its radius is 6 mm, so the claimed 250 mm total is actually 253 mm. Locating features need a fit review before printing.

Terra made a solid tower, a white lamp core, and a gold-details module grouping several disconnected components. Its windows are gold rectangular inlays; pocket placement and component fit need review. Color grouping alone does not establish practical print separation.

These are uncorrected benchmark outputs, not validated print-ready parts. Inspection is the purpose of these exports.

Front and angle PNGs are native OpenSCAD color previews, with matched camera settings. Muse is rotated 180 degrees for display because it put the windows on +Y whereas Terra used -Y. The clear sleeve appears opaque because the supplied color is opaque. The preview is not a photographic rendering or a repaired model.

Each model ZIP includes its original SCAD, assembled STL, front/angle previews, and per-module SCAD/STL exports. Export wrappers only invoke the generated modules and translate them to z=0; they preserve the original tessellation settings and do not add connectors or fix geometry. STL does not preserve colors; use SCAD for the colored assembly. The raw response metadata remains in this directory.
