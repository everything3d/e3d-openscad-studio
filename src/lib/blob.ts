import 'server-only'
import {
  BlobNotFoundError,
  head,
  issueSignedToken,
  presignUrl,
  type IssuedSignedToken,
} from '@vercel/blob'
import type { WorkspaceFile } from './types'

/** Size of a stored blob, or null when nothing is stored there. */
export async function storedBlobSize(pathname: string): Promise<number | null> {
  try {
    return (await head(pathname)).size
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null
    throw err
  }
}

/**
 * Signed download URLs outlive a working session, and files are cached in the
 * browser after the first download, so an expired URL only matters for a tab
 * left open this long without the file ever loading.
 */
const URL_LIFETIME_MS = 12 * 60 * 60 * 1000
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000

let readToken: IssuedSignedToken | null = null
let issuing: Promise<IssuedSignedToken> | null = null

/**
 * One store-wide read delegation, reused across requests: issuing one is a
 * network call, while signing a URL with it is a local HMAC. The delegation
 * itself is public; only the signing key stays on the server.
 */
async function currentReadToken(): Promise<IssuedSignedToken> {
  if (readToken && readToken.validUntil - Date.now() > URL_LIFETIME_MS + 5 * 60 * 1000) {
    return readToken
  }
  issuing ??= issueSignedToken({
    pathname: '*',
    operations: ['get'],
    validUntil: Date.now() + TOKEN_LIFETIME_MS,
  })
    .then((token) => (readToken = token))
    .finally(() => {
      issuing = null
    })
  return issuing
}

/**
 * Attach a signed download URL to each Blob-stored file, so the browser
 * fetches bytes straight from storage instead of through a function. Callers
 * must only pass files the requesting user may read.
 */
export async function withDownloadUrls(files: WorkspaceFile[]): Promise<WorkspaceFile[]> {
  if (!files.some((f) => f.blobPath)) return files
  const token = await currentReadToken()
  const validUntil = Date.now() + URL_LIFETIME_MS
  return Promise.all(
    files.map(async (f) => {
      if (!f.blobPath) return f
      const { presignedUrl } = await presignUrl(token, {
        operation: 'get',
        pathname: f.blobPath,
        access: 'private',
        validUntil,
      })
      return { ...f, url: presignedUrl }
    }),
  )
}
