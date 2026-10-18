import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_BYTES,
  MAX_PROJECT_BYTES,
  MAX_PROJECT_FILES,
  fileListProblem,
  newFileProblem,
  ownWorkspaceBlobHash,
  toFileRef,
  workspaceBlobPath,
} from './files'

const SHA = 'c'.repeat(64)

describe('workspace file limits', () => {
  it('accepts supported files up to the per-file cap', () => {
    expect(newFileProblem({ name: 'part.STL', size: MAX_FILE_BYTES })).toBeNull()
    expect(newFileProblem({ name: 'part.stl', size: MAX_FILE_BYTES + 1 })).toContain('max is 100.0 MB')
    expect(newFileProblem({ name: 'photo.png', size: 1 })).toContain('supported')
    expect(newFileProblem({ name: 'a/b.stl', size: 1 })).toContain('supported')
  })

  it('caps the file count, the project total and duplicate names', () => {
    const many = Array.from({ length: MAX_PROJECT_FILES + 1 }, (_, i) => ({ name: `${i}.stl`, size: 1 }))
    expect(fileListProblem(many)).toContain(`at most ${MAX_PROJECT_FILES}`)
    expect(
      fileListProblem([
        { name: 'a.stl', size: MAX_PROJECT_BYTES },
        { name: 'b.stl', size: 1 },
      ]),
    ).toContain('a project can hold 200.0 MB')
    expect(fileListProblem([{ name: 'a.stl', size: 1 }, { name: 'a.stl', size: 1 }])).toContain('Two files')
    expect(fileListProblem([{ name: 'a.stl', size: MAX_PROJECT_BYTES }])).toBeNull()
  })
})

describe('workspace blob paths', () => {
  it('recognizes only the user’s own content-addressed paths', () => {
    const path = workspaceBlobPath('user_1', SHA)
    expect(ownWorkspaceBlobHash('user_1', path)).toBe(SHA)
    expect(ownWorkspaceBlobHash('user_2', path)).toBeNull()
    expect(ownWorkspaceBlobHash('user_1', `${path}/x`)).toBeNull()
    expect(ownWorkspaceBlobHash('user_1', 'workspace/user_1/not-a-hash')).toBeNull()
  })

  it('sends references back without bytes or signed URLs', () => {
    expect(
      toFileRef({ name: 'a.stl', size: 1, addedAt: 2, blobPath: 'p', sha256: SHA, url: 'https://signed' }),
    ).toEqual({ name: 'a.stl', size: 1, addedAt: 2, blobPath: 'p', sha256: SHA })
    expect(toFileRef({ name: 'b.scad', size: 1, addedAt: 2, data: 'aGk=' })).toEqual({
      name: 'b.scad',
      size: 1,
      addedAt: 2,
    })
  })
})
