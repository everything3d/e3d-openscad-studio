import { tool } from 'ai'
import { z } from 'zod'
import { loadCatalogEntries, type CatalogEntry } from '@/lib/google-fonts-catalog'

/** Non-Google faces bundled with the renderer, so searches also find them. */
const BUNDLED_EXTRAS: CatalogEntry[] = [
  { family: 'Baby Donuts', category: 'Display' },
  { family: 'Liberation Sans', category: 'Sans Serif' },
  { family: 'Liberation Serif', category: 'Serif' },
  { family: 'Liberation Mono', category: 'Monospace' },
]

const CATEGORY_LABELS: Record<string, string> = {
  serif: 'Serif',
  'sans-serif': 'Sans Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
}

export const searchFontsTool = tool({
  description:
    'Search the live catalog of fonts available to text() — all ~1800 Google Fonts families plus the bundled faces. ' +
    'Use it to verify a family name exists before writing it into code, or to discover fonts by name fragment or category. ' +
    'Returns exact family names to pass as text(font = "...").',
  inputSchema: z.object({
    query: z
      .string()
      .default('')
      .describe('Case-insensitive fragment of the family name, e.g. "gummy". Empty matches everything.'),
    category: z
      .enum(['serif', 'sans-serif', 'display', 'handwriting', 'monospace'])
      .optional()
      .describe('Restrict results to one category.'),
  }),
  execute: async ({ query, category }) => {
    const entries = [...BUNDLED_EXTRAS, ...(await loadCatalogEntries())]
    const q = query.trim().toLowerCase()
    const cat = category ? CATEGORY_LABELS[category] : null
    const matches = entries.filter(
      (e) =>
        (!q || e.family.toLowerCase().includes(q)) &&
        (!cat || e.category === cat),
    )
    return {
      total: matches.length,
      // Plenty for picking a font, small enough to keep the context lean.
      fonts: matches.slice(0, 40).map((e) => `${e.family} (${e.category})`),
    }
  },
})
