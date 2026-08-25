import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { CANONICAL_LIMITS, type CanonicalVisibility } from './types'

const optionalText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit)
    .optional()
    .nullable()
    .transform((value) => value || null)

const patchOptionalText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null))

export function isValidCanonicalThumbnail(value: string | null | undefined): boolean {
  if (!value) return true
  const match = /^data:image\/(?:webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!match) return false
  return Buffer.byteLength(match[1], 'base64') <= CANONICAL_LIMITS.thumbnailBytes
}

export const publishCanonicalSchema = z.object({
  projectId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(CANONICAL_LIMITS.title),
  description: z.string().trim().min(1).max(CANONICAL_LIMITS.description),
  category: optionalText(CANONICAL_LIMITS.category),
  modificationGuide: z.string().trim().max(CANONICAL_LIMITS.modificationGuide).default(''),
  thumbnail: z
    .string()
    .nullable()
    .optional()
    .refine(isValidCanonicalThumbnail, 'Thumbnail must be a JPEG/WebP data URL under 300 KB')
    .transform((value) => value || null),
  changeSummary: optionalText(CANONICAL_LIMITS.changeSummary),
  visibility: z.enum(['private', 'published']).default('private'),
})

export const publishCanonicalVersionSchema = publishCanonicalSchema.extend({
  visibility: z.enum(['private', 'published']).optional(),
})

export const updateCanonicalSchema = z
  .object({
    title: z.string().trim().min(1).max(CANONICAL_LIMITS.title).optional(),
    description: z.string().trim().min(1).max(CANONICAL_LIMITS.description).optional(),
    category: patchOptionalText(CANONICAL_LIMITS.category),
    visibility: z.enum(['private', 'published']).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), 'No changes provided')

export function publisherIds(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/** Whether a write is allowed after accounting for the visibility it produces. */
export function canManageCanonicalVisibility(
  currentVisibility: CanonicalVisibility,
  requestedVisibility: CanonicalVisibility | undefined,
  isPublisher: boolean,
): boolean {
  return (requestedVisibility ?? currentVisibility) !== 'published' || isPublisher
}

export function buildCanonicalProjectSeed({
  id,
  title,
  versionId,
  code,
}: {
  id: string
  title: string
  versionId: string
  code: string
}) {
  return {
    name: `${title} — new`,
    code,
    canonicalDesignId: id,
    canonicalVersionId: versionId,
  }
}
