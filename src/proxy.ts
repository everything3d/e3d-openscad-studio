import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// The landing page and auth pages are public; the studio and all data APIs
// require a signed-in user.
const isProtectedRoute = createRouteMatcher(['/studio(.*)', '/api(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
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
