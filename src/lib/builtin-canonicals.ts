import { createHash } from 'node:crypto'
import { AWARD_PLAQUE_BASE_SCAD, FIGURINE_DISPLAY_BASE_SCAD } from './builtin-scad/display-base'
import { DESK_NAMEPLATE_SCAD } from './builtin-scad/desk-nameplate'
import { LETTER_PEN_STAND_SCAD } from './builtin-scad/letter-pen-stand'
import { LETTER_STANDS_LIBRARY_SCAD } from './builtin-scad/letter-stands-library'
import { MINI_BARBELL_SCAD } from './builtin-scad/mini-barbell'
import { NAME_KEYCHAIN_SCAD } from './builtin-scad/name-keychain'
import { PACIFICO_OUTLINES_SCAD } from './builtin-scad/pacifico-outlines'
import { PODIUM_NAMEPLATE_SCAD } from './builtin-scad/podium-nameplate'
import { THREE_LAYER_NAME_PIGGY_BANK_SCAD } from './builtin-scad/three-layer-name-piggy-bank'
import { TWO_LAYER_NAME_PIGGY_BANK_SCAD } from './builtin-scad/two-layer-name-piggy-bank'
import { TWO_NAME_ILLUSION_SCAD } from './builtin-scad/two-name-illusion'
import type { WorkspaceFile } from './types'

export const SYSTEM_CANONICAL_OWNER_ID = 'system:e3d'

export interface BuiltInCanonical {
  id: string
  title: string
  description: string
  category: string
  code: string
  modificationGuide: string
  thumbnail: string
  /**
   * Text workspace files the program pulls in with `use <name>`. Bulky
   * geometry data belongs here rather than in `code`: the agent reads and
   * rewrites the whole program on every change, but only sees file names.
   */
  files?: readonly { name: string; text: string }[]
  /**
   * Earlier ids for this same design, retired by a rename or a merge. A
   * database seeded before the change still holds those rows, so the seeder
   * archives them instead of leaving the library showing the design twice.
   */
  supersedes?: readonly string[]
}

/**
 * Id of the immutable version row holding a starter's current content.
 *
 * Derived from the content itself, so editing a starter's code, guide or
 * thumbnail yields a new version id and the seeder publishes it as the next
 * version. A hand-maintained id would be easy to forget to bump, and the
 * edit would then never reach a database that was already seeded.
 */
export function builtInVersionId(starter: BuiltInCanonical): string {
  const hash = createHash('sha256')
    .update(starter.code)
    .update('\0')
    .update(starter.modificationGuide)
    .update('\0')
    .update(starter.thumbnail)
  for (const file of starter.files ?? []) hash.update('\0').update(file.name).update('\0').update(file.text)
  const digest = hash.digest('hex')
  return `${starter.id}-${digest.slice(0, 12)}`
}

/**
 * A starter's workspace files as stored on its version row. `addedAt` is the
 * file's index, which keeps workspaces listing them in the declared order.
 */
export function builtInWorkspaceFiles(starter: BuiltInCanonical): WorkspaceFile[] {
  return (starter.files ?? []).map((file, index) => {
    const data = Buffer.from(file.text, 'utf8')
    return { name: file.name, data: data.toString('base64'), size: data.byteLength, addedAt: index }
  })
}

const PRINT_FIT_GUIDANCE = `- Change parts one at a time and re-render; the studio shows OpenSCAD warnings and errors.
- Clearance and tolerance values control how printed parts fit together. Change them in steps of 0.05–0.1 mm.`

/**
 * Product-owned canonical designs installed automatically into the shared catalog.
 * IDs are deliberately stable so every deployment converges on the same rows.
 * The order is the order the starter library presents them in: the piggy bank
 * leads as the hero design.
 */
export const BUILT_IN_CANONICALS: readonly BuiltInCanonical[] = [
  {
    id: 'builtin-three-layer-name-piggy-bank',
    title: 'Three-layer name piggy bank',
    description:
      'A hollow coin bank cut to the shape of a name, with a coin slot and a removable coin lid. The name stands out in three colors — plate, outline and face — for a raised two-tone look.',
    category: 'Personalized gifts',
    code: THREE_LAYER_NAME_PIGGY_BANK_SCAD,
    modificationGuide: `Keep the bank’s fitted parts and print layout intact while customizing it.

Common changes:
- Change "name" first. For names of four letters or fewer, raise letterSpacing toward 1.2 so the bank stays a practical size.
- Adjust nameXScale to fit long names without making the letters shorter. Keep every piece of name geometry routed through name_text() so the plate, outline and face stay aligned.
- boxColor, fontColor2 and fontColor are the three printable color regions (body, outline, letter face).
- backText engraves a short message, such as "Love, Mom", into the underside.
- Every part is laid out flat for slicing, with the name lid face up (raised name on top). Keep it face up — printing it upside down ruins the name.
${PRINT_FIT_GUIDANCE}

Gotchas:
- The layout is derived from textmetrics(); preserve that metric-derived positioning.
- Keep the downward name tenon aligned with the matching plate recess.
- Preserve wall thickness around the hollow body, coin slot and coin lid opening.
- Spicy Sale is bundled. If you change fonts, re-check the body width, the gap-filling band and any unsupported letter islands.`,
    thumbnail: '/canonicals/three-layer-name-piggy-bank.webp',
    supersedes: ['builtin-name-sign-piggy-bank'],
  },
  {
    id: 'builtin-two-layer-name-piggy-bank',
    title: 'Two-layer name piggy bank',
    description:
      'A hollow coin bank cut to the shape of a name, with a coin slot and a removable coin lid. Prints in two colors — plate and raised name — on any two-color setup.',
    category: 'Personalized gifts',
    code: TWO_LAYER_NAME_PIGGY_BANK_SCAD,
    modificationGuide: `Keep the bank’s fitted parts and print layout intact while customizing it.

Common changes:
- Change "name" first. For names of four letters or fewer, raise letterSpacing toward 1.2 so the bank stays a practical size.
- boxColor and fontColor are the two printable color regions.
- textSize scales the whole bank; extrudeHeight sets its height.
- Every part is laid out flat for slicing, with the name lid face up (raised name on top). Keep it face up — printing it upside down ruins the name.
${PRINT_FIT_GUIDANCE}

Gotchas:
- The layout is derived from textmetrics(); preserve that metric-derived positioning.
- Keep the downward name tenon aligned with the matching plate recess.
- Preserve wall thickness around the hollow body, coin slot and coin lid opening.
- Baby Donuts is bundled. If you change fonts, re-check the body width, the gap-filling band and any unsupported letter islands.`,
    thumbnail: '/canonicals/two-layer-name-piggy-bank.webp',
    supersedes: ['builtin-two-color-name-sign-piggy-bank'],
  },
  {
    id: 'builtin-name-keychain',
    title: 'Name keychain',
    description:
      'A rounded name badge with a keyring tab, printed flat in three colors. The badge widens to fit any name — a quick first print.',
    category: 'Personalized gifts',
    code: NAME_KEYCHAIN_SCAD,
    modificationGuide: `The badge and name size themselves from textmetrics(), so most changes need only the name.

Common changes:
- Change "name". Long names widen the badge; tall fonts are scaled down to fit badgeHeight.
- baseColor, panelColor and accentColor are the three printable regions (dark base, light panel, raised border and name).
- font: chunky, rounded faces such as Righteous, Bangers or Baby Donuts survive small sizes best.
- holeDiameter and tabDiameter size the keyring hole; keep at least 1.5 mm of wall around it.

Gotchas:
- It prints flat with no supports. Keep the name and border raised above the panel rather than recessed.
- Thin script fonts can break at keychain size; prefer bold display faces.
- The color changes happen at layer heights (panelBottom, panelTop, baseHeight); keep them in increasing order.`,
    thumbnail: '/canonicals/name-keychain.webp',
  },
  {
    id: 'builtin-desk-nameplate',
    title: 'Desk nameplate',
    description:
      'A flat nameplate with a raised name, title and rim, plus a stand that holds it leaning back. The plate prints face up, so the lettering comes out crisp.',
    category: 'Desk & display',
    code: DESK_NAMEPLATE_SCAD,
    modificationGuide: `Two separate parts: a flat plate and a slotted stand. Keep them separate so the plate prints face up.

Common changes:
- Set name and title. Leave title empty for a name-only plate.
- nameFont and titleFont: a heavy face for the name and a clean sans for the title read best across a desk.
- The plate widens to fit the text between minPlateWidth and maxPlateWidth; text shrinks only past maxPlateWidth.
- plateColor, textColor and standColor are the printable regions; the rim prints in the text color.
- leanAngle sets the reading angle; showAssembled = true previews the plate standing in the stand.
${PRINT_FIT_GUIDANCE}

Gotchas:
- slotClearance controls the plate-to-stand fit. If the plate is loose or tight, adjust it, not plateThickness alone.
- Keep slotDepth at least 3 mm short of standHeight so the slot floor stays solid.
- Very long text shrinks to fit; for long titles, prefer a shorter wording or a narrower font.`,
    thumbnail: '/canonicals/desk-nameplate.webp',
  },
  {
    id: 'builtin-figurine-display-base',
    title: 'Figurine display base',
    description:
      'A display base with a flat top for a figurine and a sloped front plaque with a name and a modeled heart. The plaque prints separately for clean two-color lettering.',
    category: 'Desk & display',
    code: FIGURINE_DISPLAY_BASE_SCAD,
    modificationGuide: `A wedge base with a recessed pocket on its sloped face, plus a plaque that prints separately and drops in.

Common changes:
- Set line1 (and optionally line2/line3). Every line shrinks to fit the plaque width automatically.
- show_heart adds a modeled heart after line 1; it is geometry, not an emoji, so it prints reliably in its own color.
- two_sided adds a matching sloped face and blank plaque at the back, for bases seen from both sides.
- base_width, base_depth and base_height size the base; face_setback reclines the front face and makes the plaque taller.
- show_assembled = true previews the plaque fitted into the base.
${PRINT_FIT_GUIDANCE}

Gotchas:
- Keep the plaque size derived from the recess (plaque_w, plaque_h) so the plaque always fits its pocket.
- plaque_clearance is the single fit knob; very small values can make the plaque too tight to insert.
- If extra lines do not fit, the render stops with a message: raise face_setback or base_height, or reduce the text sizes.`,
    thumbnail: '/canonicals/figurine-display-base.webp',
    supersedes: ['Sc2BhycGQvLVxSgo', 'ha4MQVRHMIDMBMuz', 'V6SvgzkUL6k0mEM8'],
  },
  {
    id: 'builtin-award-plaque-base',
    title: 'Award plaque base',
    description:
      'A wide base with a reclined plaque for a name, a dedication and a closing line. Use it for awards and thank-you gifts, or under a figurine.',
    category: 'Desk & display',
    code: AWARD_PLAQUE_BASE_SCAD,
    modificationGuide: `The same recessed-plaque base as the figurine display base, set up for three lines of text.

Common changes:
- Set line1 (the name), line2 and line3. Leave a line empty to hide it; the remaining lines re-centre.
- font1 is used for line 1 and font2 for lines 2–3. Engraved-style serifs such as Cinzel and Lora suit awards.
- line1_color and line2_color color the text; base_color and plaque_color color the parts.
- Each line shrinks to fit the plaque width. For more height, raise face_setback or base_height.
- show_assembled = true previews the plaque fitted into the base.
${PRINT_FIT_GUIDANCE}

Gotchas:
- Keep the plaque size derived from the recess (plaque_w, plaque_h) so the plaque always fits its pocket.
- Long dedications get small. Keep line 2 and line 3 short, or widen the base.
- The text block must fit the plaque height; the render stops with a message if it does not.`,
    thumbnail: '/canonicals/award-plaque-base.webp',
    supersedes: ['6TLOjLkIkM3Iv7kp', 'MuJyqR8R7BMdK2eP'],
  },
  {
    id: 'builtin-podium-nameplate',
    title: 'Podium nameplate',
    description:
      'A thin rounded plate with a raised name and up to two taglines, sized for the front of a figurine podium or trophy. Prints flat in three colors.',
    category: 'Desk & display',
    code: PODIUM_NAMEPLATE_SCAD,
    modificationGuide: `A single flat plate (109 × 49 × 1 mm by default) with raised text in two colors. It is often made in batches: one plate per person, same style, different name and taglines.

Common changes:
- Set name, tagline1 and tagline2. Leave a tagline empty to drop it; the text block re-centres for one or zero taglines.
- The name shrinks only when it would overrun the plate. Both taglines share one size, which grows to fill the plate width up to tagMaxSize (tagMaxSizeTwoTags when there are two lines), so a short tagline gets bigger, not lost.
- nameFont and tagFont: Cutive (typewriter serif) for the name and Akaya Kanadaka (playful hand-drawn) for the taglines is the house style. Change them only if the user asks.
- plateColor, nameColor and tagColor are the three printable regions.
- plateLength, plateWidth and cornerRadius size the plate to match a podium face.

Gotchas:
- The line positions in the Layout group are tuned for the default plate size and text sizes. If you change plateWidth or the text sizes a lot, move them too so lines do not overlap or hit the edge.
- Very long taglines get small. Split them across tagline1 and tagline2 rather than shrinking below about 3.5 mm.
- Keep textHeight at 0.4 mm or more so the color change shows after slicing.`,
    thumbnail: '/canonicals/podium-nameplate.webp',
  },
  {
    id: 'builtin-two-name-illusion',
    title: 'Two-name illusion',
    description:
      'A sculpture that reads one name from the front and another after a quarter turn, on a rounded display base.',
    category: 'Personalized gifts',
    code: TWO_NAME_ILLUSION_SCAD,
    modificationGuide: `The solid is the intersection of two perpendicular extruded word silhouettes. Each word reads only when viewed straight on from its own side.

Common changes:
- Set frontName and sideName to the two names or short words.
- Prefer uppercase text and a bold font. Liberation Mono Bold is bundled and gives even, predictable strokes.
- Adjust letterSize and letterSpacing for the overall footprint. strokeBoost strengthens thin intersections.
- Change base padding, height, corner radius or colors without altering the illusion geometry.

Gotchas:
- Always inspect both straight-on views after changing words. Curved or thin letter pairs can create fragile slivers.
- Words of similar length give the cleanest result; very long names make the base large and the strokes thin.
- Lowercase letters with dots or ascenders (i, j, h) leave stray pieces. Use uppercase.
- Keep the small overlap between the sculpture and base so the exported mesh stays connected.`,
    thumbnail: '/canonicals/two-name-illusion.webp',
  },
  {
    id: 'builtin-letter-pen-stand',
    title: 'Letter pen stand with cursive name',
    description:
      'A serif initial that stands upright and holds pens in a pocket behind it, plus a separate one-piece cursive name to set in front.',
    category: 'Desk & display',
    code: LETTER_PEN_STAND_SCAD,
    files: [
      { name: 'letter-stands.scad', text: LETTER_STANDS_LIBRARY_SCAD },
      { name: 'pacifico-outlines.scad', text: PACIFICO_OUTLINES_SCAD },
    ],
    modificationGuide: `Two separate solids: an upright letter stand (from letter-stands.scad) and a flat cursive name (from the Pacifico outlines in pacifico-outlines.scad). Both library files are workspace files; edit the main program, not them.

Common changes:
- Change name_text first. big_letter = "auto" uses the name's first letter for the stand.
- Stands exist only for A B C D G H J L M N P R S T U V Z. For a name starting with any other letter (E, F, I, K, O, Q, W, X, Y), set big_letter to one of those or the render stops with "Unsupported letter". Do not try to draw a new stand letter unless the user asks for one.
- export_part: "both" lays out the stand and name side by side; "stand" or "name" exports one part.
- stand_height_mm scales the whole stand and its pocket uniformly.
- name_width_mm sets the name's overall width; its height follows the handwriting proportions. name_thickness_mm is the extrusion height.
- name_bridge_width_mm and name_stroke_expansion_mm strengthen delicate joins. Raise them slightly for small names.

Gotchas:
- The name uses the embedded Pacifico outlines, not text(), so the bridges can join every separate piece (i/j dots, unjoined capitals, word gaps) into one solid. Keep cursive_name() on the outlines; switching to text() leaves loose pieces.
- Only basic Latin (ASCII) characters are in the outlines; accented letters stop the render.
- The stand prints upright on its base; the name prints flat at Z=0.`,
    thumbnail: '/canonicals/letter-pen-stand.webp',
  },
  {
    id: 'builtin-mini-barbell',
    title: 'Mini barbell with bumper plates',
    description:
      'A desk-size barbell with colour-coded bumper plates that slide on and off, so it can be loaded to match a lift. The plates print flat with raised weight labels; the bar glues together from three parts.',
    category: 'Desk & display',
    code: MINI_BARBELL_SCAD,
    modificationGuide: `Three kinds of part: bumper plates, one shaft and two end pieces (collar + sleeve) that glue onto the shaft. showAssembled = false lays them all out flat for slicing; true shows the bar loaded with loadPerSide.

Common changes:
- Edit the plates list. Each row is [label, overall thickness, plate colour, label colour, count]. Add or remove rows to change the set; count sets how many of each get printed.
- unitLabel switches the unit text, e.g. "LB" with labels like "45" and "2.5". Labels are squeezed to fit, so decimals work.
- loadPerSide lists the plates on each side in the assembled view, inner to outer, by label. Every label must exist in plates.
- sleeveLength sets how many plates fit per side. The render stops with a message if loadPerSide is thicker than the sleeve.
- gripLength is the bar between the collars. Match it to a figurine's hands when the bar is held by a figure.
- show = "plates" or "bar" exports just one kind of part.
${PRINT_FIT_GUIDANCE}

Gotchas:
- Plates print back-down: the back is completely flat and every raised detail is on the face. Keep it that way, or the plate needs supports.
- The label colour also prints the hub insert, so each plate is two colours. On a white plate use a dark label colour.
- plateHoleClearance is the plate-on-sleeve fit (0.5 mm slides on and off easily). socketClearance is the end-on-shaft fit; the ends are glued, so it only needs to slide on.
- Keep socketDepth deep (about 20 mm). Shallow sockets let the glued ends droop under the plates.
- The shaft prints lying on its flat (shaftFlat); the end pieces print standing on the collar with the socket opening on the bed.`,
    thumbnail: '/canonicals/mini-barbell.webp',
  },
] as const

/**
 * Shared-library designs taken out of circulation at launch that no built-in
 * supersedes. They were published from personal projects and carry real
 * customer names, while the shared library is visible to every user.
 * Archiving keeps any workspace already started from them working.
 */
export const RETIRED_CANONICAL_IDS: readonly string[] = [
  'Q8yWjEFEQ26y5nTI', // Serif Letter Pen Stand
  'POzTAGzN9mmXT5Up', // Two-Color Name SVG Signs
  'I2yF0bCGuBzXIOSr', // Two-Color Name SVG Signs — customer copy
]
