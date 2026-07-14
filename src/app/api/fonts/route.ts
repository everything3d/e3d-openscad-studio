import type { NextRequest } from 'next/server'

/**
 * On-demand Google Fonts proxy for the OpenSCAD renderer.
 *
 * GET /api/fonts?family=Amatic+SC[&style=Bold Italic] → raw TTF bytes.
 *
 * The Google Fonts CSS API serves plain (non-subset) TTF urls to legacy
 * user agents, which is exactly what the wasm build's fontconfig/FreeType
 * can consume — no woff2/brotli support needed. Responses are immutable and
 * CDN-cached, so each font is fetched from Google roughly once per region.
 */

export const maxDuration = 30

// Google font family names are letters, digits and spaces ("Press Start 2P").
const FAMILY_RE = /^[A-Za-z0-9 ]{1,64}$/
const STYLE_RE = /^[A-Za-z ]{0,40}$/

const WEIGHTS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
}

/** css2 variant selector for a fontconfig style string ("Bold Italic"). */
function variantQuery(style: string): string | null {
  let weight = 400
  let italic = 0
  for (const word of style.toLowerCase().split(/\s+/).filter(Boolean)) {
    if (word === 'italic' || word === 'oblique') italic = 1
    else if (word in WEIGHTS) weight = WEIGHTS[word]
  }
  if (weight === 400 && italic === 0) return null
  return `:ital,wght@${italic},${weight}`
}

function fetchCss(family: string, variant: string | null): Promise<Response> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}${variant ?? ''}`
  // A legacy UA makes the CSS API return truetype urls instead of woff2.
  return fetch(url, { headers: { 'User-Agent': 'curl/8.4.0' } })
}

// The css2 API is case-sensitive ("sour gummy" 400s, "Sour Gummy" works),
// and users hand-type font names into code. Google's catalog lets us resolve
// any casing to the canonical family name. Cached per function instance.
let catalogPromise: Promise<Map<string, string>> | null = null

function loadCatalog(): Promise<Map<string, string>> {
  catalogPromise ??= (async () => {
    const res = await fetch('https://fonts.google.com/metadata/fonts', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`)
    // Some deployments prefix this endpoint with the )]}' XSSI guard.
    const text = (await res.text()).replace(/^\)\]\}'/, '')
    const meta = JSON.parse(text) as { familyMetadataList: { family: string }[] }
    const map = new Map<string, string>()
    for (const f of meta.familyMetadataList) {
      map.set(f.family.toLowerCase().replace(/\s+/g, ' '), f.family)
    }
    return map
  })()
  // On failure, clear so the next request retries instead of caching the error.
  catalogPromise.catch(() => {
    catalogPromise = null
  })
  return catalogPromise
}

/** Canonical catalog casing for a family name, or null if not on Google Fonts. */
async function canonicalFamily(family: string): Promise<string | null> {
  try {
    const catalog = await loadCatalog()
    return catalog.get(family.toLowerCase().replace(/\s+/g, ' ')) ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const family = (req.nextUrl.searchParams.get('family') ?? '').trim()
  const style = (req.nextUrl.searchParams.get('style') ?? '').trim()
  if (!FAMILY_RE.test(family) || !STYLE_RE.test(style)) {
    return Response.json({ error: 'Invalid font family or style' }, { status: 400 })
  }

  const variant = variantQuery(style)
  let res = await fetchCss(family, variant)
  if (!res.ok) {
    // Wrong casing? Resolve against the catalog ("sour gummy" → "Sour Gummy").
    const canonical = await canonicalFamily(family)
    if (canonical && canonical !== family) {
      res = await fetchCss(canonical, variant)
      if (!res.ok && variant) res = await fetchCss(canonical, null)
    } else if (variant) {
      // The family exists but not in that weight/italic — fall back to
      // regular and let fontconfig do its best-effort style matching.
      res = await fetchCss(family, null)
    }
  }
  if (!res.ok) {
    return Response.json({ error: `Unknown font family "${family}"` }, { status: 404 })
  }

  const css = await res.text()
  const ttfUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)?.[1]
  if (!ttfUrl) {
    return Response.json({ error: `No TTF available for "${family}"` }, { status: 404 })
  }

  const ttf = await fetch(ttfUrl)
  if (!ttf.ok) {
    return Response.json({ error: 'Font download failed' }, { status: 502 })
  }

  return new Response(await ttf.arrayBuffer(), {
    headers: {
      'Content-Type': 'font/ttf',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  })
}
