import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// The landing page and auth pages are public; the studio and all data APIs
// require a signed-in user. /api/fonts only proxies Google Fonts bytes
// (no user data) and stays public so responses CDN-cache cleanly.
const isProtectedRoute = createRouteMatcher(['/studio(.*)', '/api(.*)'])
const isPublicRoute = createRouteMatcher(['/api/fonts(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|wasm|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
