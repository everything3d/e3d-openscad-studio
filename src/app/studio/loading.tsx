/**
 * Shown while the studio page awaits auth and its database queries. Without
 * it the browser showed a blank window until the server had everything, which
 * on a cold instance is the longest wait on the whole page. Mirrors the shell
 * layout (sidebar + header) so the real page replaces it without a jump.
 */
export default function StudioLoading() {
  return (
    <div className="flex h-dvh overflow-hidden" aria-busy="true" aria-label="Loading the studio">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
        <div className="flex h-12 items-center gap-2 border-b px-3">
          <div className="size-5 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-4">
          <div className="h-3 w-32 rounded bg-muted" />
        </header>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading the studio…
        </div>
      </main>
    </div>
  )
}
