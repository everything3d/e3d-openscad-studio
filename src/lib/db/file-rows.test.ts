import { describe, expect, it, vi } from 'vitest'
import { MAX_PROJECT_BYTES } from '../files'
import { fileFromRow, fileToRow, planFileReplacement, type WorkspaceFileRow } from './file-rows'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const OWN_A = `workspace/user_1/${SHA_A}`
const OWN_B = `workspace/user_1/${SHA_B}`

function row(overrides: Partial<WorkspaceFileRow>): WorkspaceFileRow {
  return {
    projectId: 'p1',
    name: 'logo.svg',
    data: null,
    blobPath: null,
    sha256: null,
    size: 10,
    addedAt: new Date(1_000),
    ...overrides,
  }
}

function plan(existing: WorkspaceFileRow[], incoming: Parameters<typeof planFileReplacement>[0]['incoming'], sizes: Record<string, number> = {}) {
  const storedSize = vi.fn(async (path: string) => sizes[path] ?? null)
  return {
    storedSize,
    result: planFileReplacement({ projectId: 'p1', userId: 'user_1', existing, incoming, storedSize }),
  }
}

describe('workspace file rows', () => {
  it('reads a Blob-backed row as a reference even when an inline copy remains', () => {
    const file = fileFromRow(row({ data: 'aGk=', blobPath: OWN_A, sha256: SHA_A }))
    expect(file).toEqual({ name: 'logo.svg', size: 10, addedAt: 1_000, blobPath: OWN_A, sha256: SHA_A })
  })

  it('copies a reference without bytes and an inline file with them', () => {
    expect(fileToRow('p2', { name: 'a.stl', size: 3, addedAt: 5, blobPath: OWN_A, sha256: SHA_A })).toMatchObject({
      projectId: 'p2',
      blobPath: OWN_A,
      data: null,
    })
    expect(fileToRow('p2', { name: 'b.scad', size: 2, addedAt: 5, data: 'aGk=' })).toMatchObject({
      data: 'aGk=',
    })
  })
})

describe('planFileReplacement', () => {
  it('keeps files the project already holds, whatever the browser claims about them', async () => {
    const legacy = row({ name: 'old.png', data: 'aGk=', size: 2 })
    const { result, storedSize } = plan([legacy], [{ name: 'old.png', size: 999_999, addedAt: 0 }])
    expect(await result).toEqual({ ok: true, rows: [legacy] })
    expect(storedSize).not.toHaveBeenCalled()
  })

  it('accepts a new upload in the user’s own namespace once its stored size matches', async () => {
    const { result } = plan([], [{ name: 'part.stl', size: 50, addedAt: 7, blobPath: OWN_A, sha256: SHA_A }], {
      [OWN_A]: 50,
    })
    expect(await result).toEqual({
      ok: true,
      rows: [
        {
          projectId: 'p1',
          name: 'part.stl',
          size: 50,
          addedAt: new Date(7),
          blobPath: OWN_A,
          sha256: SHA_A,
          data: null,
        },
      ],
    })
  })

  it.each([
    ['another user’s blob', { blobPath: `workspace/user_2/${SHA_A}`, sha256: SHA_A }, { [`workspace/user_2/${SHA_A}`]: 50 }],
    ['a hash that does not match the path', { blobPath: OWN_A, sha256: SHA_B }, { [OWN_A]: 50 }],
    ['a blob that was never stored', { blobPath: OWN_A, sha256: SHA_A }, {}],
    ['a stored size that differs', { blobPath: OWN_A, sha256: SHA_A }, { [OWN_A]: 49 }],
    ['a new file with no blob', {}, {}],
  ])('rejects %s', async (_case, ref, sizes) => {
    const { result } = plan([], [{ name: 'part.stl', size: 50, addedAt: 7, ...ref }], sizes)
    expect(await result).toEqual({ ok: false, error: 'part.stl was not uploaded.' })
  })

  it('rejects unsupported new file types', async () => {
    const { result } = plan([], [{ name: 'photo.png', size: 5, addedAt: 0, blobPath: OWN_A, sha256: SHA_A }])
    expect(await result).toMatchObject({ ok: false })
  })

  it('reuses a blob the project already holds under a new name without asking storage', async () => {
    const stored = row({ name: 'a.stl', blobPath: `workspace/user_9/${SHA_B}`, sha256: SHA_B, size: 40 })
    const { result, storedSize } = plan(
      [stored],
      [{ name: 'copy.stl', size: 1, addedAt: 3, blobPath: stored.blobPath!, sha256: SHA_B }],
    )
    expect(await result).toEqual({
      ok: true,
      rows: [{ ...stored, name: 'copy.stl', addedAt: new Date(3) }],
    })
    expect(storedSize).not.toHaveBeenCalled()
  })

  it('measures the project total with stored sizes', async () => {
    const big = row({ name: 'big.stl', blobPath: OWN_B, sha256: SHA_B, size: MAX_PROJECT_BYTES })
    const { result } = plan(
      [big],
      [
        { name: 'big.stl', size: 1, addedAt: 0, blobPath: OWN_B, sha256: SHA_B },
        { name: 'more.stl', size: 1, addedAt: 0, blobPath: OWN_A, sha256: SHA_A },
      ],
      { [OWN_A]: 1 },
    )
    expect(await result).toMatchObject({ ok: false, error: expect.stringContaining('a project can hold') })
  })
})
