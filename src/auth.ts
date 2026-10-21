import NextAuth, { type Session } from 'next-auth'
import Google from 'next-auth/providers/google'

/** Only Workspace accounts on this domain can open /admin. */
export const STAFF_DOMAIN = 'everything3dindia.com'

/**
 * Staff sign-in for /admin (Auth.js v5, Google provider), the same setup as
 * the figurine studio's desk. It is separate from Clerk, which signs in
 * customers: JWT sessions, so no database tables. Reads AUTH_SECRET,
 * AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // `hd` only pre-filters Google's account picker; the real check is
      // the signIn callback below.
      authorization: { params: { hd: STAFF_DOMAIN, prompt: 'select_account' } },
    }),
  ],
  pages: { signIn: '/admin', error: '/admin' },
  callbacks: {
    signIn({ profile }) {
      return Boolean(
        profile?.email_verified &&
          profile.hd === STAFF_DOMAIN &&
          profile.email?.toLowerCase().endsWith(`@${STAFF_DOMAIN}`),
      )
    },
  },
})

export const isStaff = (session: Session | null) =>
  Boolean(session?.user?.email?.toLowerCase().endsWith(`@${STAFF_DOMAIN}`))
