'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'

/**
 * Route-level error boundary. Anything thrown while rendering a page or its
 * children lands here instead of Next's default stack screen.
 *
 * The thrown message is deliberately not displayed: in production it is
 * replaced by a digest anyway, and in development it can carry connection
 * strings and provider detail. The real error goes to the console, where a
 * developer or an error reporter can pick it up.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] unhandled error', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page could not be displayed. Your saved designs are unaffected.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/studio" className={buttonVariants({ variant: 'outline' })}>
          Back to the studio
        </Link>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
    </main>
  )
}
