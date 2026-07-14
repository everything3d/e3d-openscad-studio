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

export async function GET(req: NextRequest) {
  const family = (req.nextUrl.searchParams.get('family') ?? '').trim()
  const style = (req.nextUrl.searchParams.get('style') ?? '').trim()
  if (!FAMILY_RE.test(family) || !STYLE_RE.test(style)) {
    return Response.json({ error: 'Invalid font family or style' }, { status: 400 })
  }

  const variant = variantQuery(style)
  let res = await fetchCss(family, variant)
  if (!res.ok && variant) {
    // The family exists but not in that weight/italic — fall back to regular
    // and let fontconfig do its best-effort style matching.
    res = await fetchCss(family, null)
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
