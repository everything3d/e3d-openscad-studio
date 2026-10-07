import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/**
 * Shown for unknown URLs and wherever a route calls `notFound()` — most often
 * a share link that was revoked or mistyped, so the copy speaks to that rather
 * than to a generic missing page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This page does not exist. If you followed a share link, it may have been replaced or
          turned off by its owner.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/studio" className={buttonVariants()}>
          Go to the studio
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Home
        </Link>
      </div>
    </main>
  )
}
