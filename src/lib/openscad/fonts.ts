/**
 * Font support for OpenSCAD `text()`.
 *
 * A base set of fonts ships in public/openscad/fonts.zip and is written to
 * the wasm FS on every render. Everything else on Google Fonts (~1800
 * families) is fetched on demand through /api/fonts and dropped into the
 * same fontconfig directory — see render.worker.ts.
 */

/** Families bundled in fonts.zip, lowercased (regular weight unless noted). */
export const BUNDLED_FAMILIES = new Set(
  [
    'Liberation Sans',
    'Liberation Serif',
    'Liberation Mono',
    'Noto Sans',
    'Noto Naskh Arabic',
    'Noto Sans Armenian',
    'Noto Sans Balinese',
    'Noto Sans Bengali',
    'Noto Sans Devanagari',
    'Noto Sans Ethiopic',
    'Noto Sans Georgian',
    'Noto Sans Gujarati',
    'Noto Sans Gurmukhi',
    'Noto Sans Hebrew',
    'Noto Sans Javanese',
    'Noto Sans Kannada',
    'Noto Sans Khmer',
    'Noto Sans Lao',
    'Noto Sans Mongolian',
    'Noto Sans Myanmar',
    'Noto Sans Oriya',
    'Noto Sans Sinhala',
    'Noto Sans Tamil',
    'Noto Sans Thai',
    'Noto Sans Tibetan',
    'Noto Sans Tifinagh',
    'Baby Donuts',
    'Spicy Sale',
    'Abril Fatface',
    'Alfa Slab One',
    'Allura',
    'Anton',
    'Archivo Black',
    'Audiowide',
    'Bangers',
    'Bebas Neue',
    'Caveat',
    'Cinzel',
    'Courgette',
    'Courier Prime',
    'Dancing Script',
    'EB Garamond',
    'Fira Code',
    'Great Vibes',
    'JetBrains Mono',
    'Kalam',
    'Lato',
    'Lobster',
    'Lora',
    'Merriweather',
    'Monoton',
    'Montserrat',
    'Nunito',
    'Open Sans',
    'Orbitron',
    'Oswald',
    'Pacifico',
    'Playfair Display',
    'Poppins',
    'Press Start 2P',
    'Raleway',
    'Righteous',
    'Roboto',
    'Sacramento',
    'Satisfy',
    'Space Mono',
  ].map((f) => f.toLowerCase()),
)

/** Bundled families that also include Bold/Italic files. */
const FULL_STYLE_FAMILIES = new Set([
  'liberation sans',
  'liberation serif',
  'liberation mono',
  'noto sans',
])

const REGULAR_STYLES = new Set(['', 'regular', 'normal', 'book'])

export interface FontSpec {
  family: string
  /** fontconfig style string, e.g. "Bold", "Bold Italic". Empty = regular. */
  style: string
}

/** Parse a fontconfig-ish font string ("Family[:style=Style]") into a spec. */
export function parseFontSpec(raw: string): FontSpec | null {
  const [familyPart, ...rest] = raw.split(':')
  const family = familyPart.trim().replace(/\s+/g, ' ')
  if (!family) return null
  const style = rest.join(':').match(/style\s*=\s*([^:]+)/i)?.[1].trim() ?? ''
  return { family, style }
}

export function specKey(spec: FontSpec): string {
  return `${spec.family}|${spec.style}`.toLowerCase()
}

/**
 * Extract every `font = "Family[:style=Style]"` spec from OpenSCAD source.
 * Deduplicated case-insensitively.
 */
export function extractFontSpecs(code: string): FontSpec[] {
  const specs = new Map<string, FontSpec>()
  for (const m of code.matchAll(/\bfont\s*=\s*"([^"]+)"/g)) {
    const spec = parseFontSpec(m[1])
    if (spec) specs.set(specKey(spec), spec)
  }
  return [...specs.values()]
}

/**
 * Every string literal in the source that names a Google Fonts family
 * (per `catalog`, a set of lowercased family names). This catches fonts
 * that reach text() through variables or module parameters, where a
 * literal `font = "..."` never appears in the code.
 */
export function extractCatalogFontSpecs(code: string, catalog: Set<string>): FontSpec[] {
  const specs = new Map<string, FontSpec>()
  for (const m of code.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const spec = parseFontSpec(m[1])
    if (spec && catalog.has(spec.family.toLowerCase())) {
      specs.set(specKey(spec), spec)
    }
  }
  return [...specs.values()]
}

/** Whether a spec needs a Google Fonts fetch (i.e. the bundle can't serve it). */
export function needsGoogleFetch({ family, style }: FontSpec): boolean {
  const fam = family.toLowerCase()
  if (FULL_STYLE_FAMILIES.has(fam)) return false
  if (BUNDLED_FAMILIES.has(fam) && REGULAR_STYLES.has(style.toLowerCase())) return false
  return true
}
