'use client'

import { useEffect } from 'react'

/**
 * The last line of defence: an error thrown by the root layout itself, before
 * any of the normal shell exists. It replaces the whole document, so it must
 * render its own <html> and <body> and cannot rely on the app's providers,
 * fonts, or component library.
 *
 * Styles are inline for the same reason — a failure severe enough to reach
 * here may be the stylesheet not loading.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] root layout error', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>E3D Studio is unavailable</h1>
        <p style={{ margin: 0, maxWidth: '28rem', fontSize: '0.875rem', color: '#a1a1a1' }}>
          The application failed to start. Your saved designs are unaffected.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#0a0a0a',
            background: '#fafafa',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
        {error.digest && (
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', color: '#a1a1a1' }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
