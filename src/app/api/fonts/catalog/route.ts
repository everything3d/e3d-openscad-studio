import { loadCatalog } from '@/lib/google-fonts-catalog'

/**
 * Canonical Google Fonts family names, for the render worker's static
 * font-name scan. ~35 KB raw, gzipped on the wire, CDN-cached for a day.
 */

export const maxDuration = 30

export async function GET() {
  try {
    const catalog = await loadCatalog()
    return Response.json([...catalog.values()], {
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch {
    return Response.json({ error: 'Font catalog unavailable' }, { status: 502 })
  }
}
