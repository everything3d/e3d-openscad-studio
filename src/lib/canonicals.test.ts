import { describe, expect, it } from 'vitest'
import {
  buildCanonicalProjectSeed,
  isValidCanonicalThumbnail,
  publishCanonicalSchema,
  publishCanonicalVersionSchema,
  updateCanonicalSchema,
} from './canonicals'

describe('canonical domain helpers', () => {
  it('builds a clean workspace seed without conversation data', () => {
    const seed = buildCanonicalProjectSeed({
      id: 'starter-1',
      title: 'Name Plaque',
      versionId: 'version-3',
      code: 'cube(10);',
    })
    expect(seed).toEqual({
      name: 'Name Plaque — new',
      code: 'cube(10);',
      canonicalDesignId: 'starter-1',
      canonicalVersionId: 'version-3',
    })
    expect(seed).not.toHaveProperty('messages')
  })

  it('accepts bounded JPEG/WebP thumbnails and rejects other data', () => {
    expect(isValidCanonicalThumbnail('data:image/jpeg;base64,aGVsbG8=')).toBe(true)
    expect(isValidCanonicalThumbnail('data:image/webp;base64,aGVsbG8=')).toBe(true)
    expect(isValidCanonicalThumbnail('data:image/png;base64,aGVsbG8=')).toBe(false)
    expect(isValidCanonicalThumbnail('https://example.com/image.jpg')).toBe(false)
    const tooLarge = Buffer.alloc(300_001).toString('base64')
    expect(isValidCanonicalThumbnail(`data:image/jpeg;base64,${tooLarge}`)).toBe(false)
  })

  it('requires reviewed starter metadata', () => {
    expect(
      publishCanonicalSchema.safeParse({
        projectId: 'project-1',
        title: 'Name Plaque',
        description: 'A reusable plaque.',
        modificationGuide: '',
      }).success,
    ).toBe(true)
    expect(publishCanonicalSchema.safeParse({ projectId: 'project-1' }).success).toBe(false)
    expect(
      publishCanonicalVersionSchema.parse({
        projectId: 'project-1',
        title: 'Name Plaque',
        description: 'A reusable plaque.',
        modificationGuide: '',
      }),
    ).toEqual({
      projectId: 'project-1',
      title: 'Name Plaque',
      description: 'A reusable plaque.',
      category: null,
      modificationGuide: '',
      thumbnail: null,
      changeSummary: null,
    })
  })

  it('rejects empty metadata patches without turning omitted category into null', () => {
    expect(updateCanonicalSchema.safeParse({}).success).toBe(false)
    const parsed = updateCanonicalSchema.parse({ title: 'Updated starter' })
    expect(parsed).toEqual({ title: 'Updated starter' })
  })
})
