/**
 * Google Fonts catalog, fetched from Google's metadata endpoint and cached
 * per server instance. Used by /api/fonts to resolve case-insensitive family
 * names, by /api/fonts/catalog to give the render worker the list of real
 * families to scan code for, and by the agent's searchFonts tool.
 */

export interface CatalogEntry {
  family: string
  /** "Serif" | "Sans Serif" | "Display" | "Handwriting" | "Monospace" */
  category: string
}

let entriesPromise: Promise<CatalogEntry[]> | null = null

export function loadCatalogEntries(): Promise<CatalogEntry[]> {
  entriesPromise ??= (async () => {
    const res = await fetch('https://fonts.google.com/metadata/fonts', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`)
    // Some deployments prefix this endpoint with the )]}' XSSI guard.
    const text = (await res.text()).replace(/^\)\]\}'/, '')
    const meta = JSON.parse(text) as {
      familyMetadataList: { family: string; category: string }[]
    }
    return meta.familyMetadataList.map((f) => ({
      family: f.family,
      category: f.category,
    }))
  })()
  // On failure, clear so the next request retries instead of caching the error.
  entriesPromise.catch(() => {
    entriesPromise = null
  })
  return entriesPromise
}

/** Map of normalized (lowercased, space-collapsed) name → canonical name. */
export async function loadCatalog(): Promise<Map<string, string>> {
  const entries = await loadCatalogEntries()
  const map = new Map<string, string>()
  for (const e of entries) {
    map.set(e.family.toLowerCase().replace(/\s+/g, ' '), e.family)
  }
  return map
}
