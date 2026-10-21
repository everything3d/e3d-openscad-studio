import { ShieldCheckIcon } from 'lucide-react'
import { signIn, STAFF_DOMAIN } from '@/auth'
import { Button } from '@/components/ui/button'

/** Google sign-in gate shared by every /admin page. */
export function SignInScreen({ denied, redirectTo }: { denied: boolean; redirectTo: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-2xl shadow-black/20">
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl border bg-muted">
          <ShieldCheckIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          E3D Studio · Admin
        </div>
        <h1 className="mt-1 text-xl font-semibold">Staff sign-in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use your @{STAFF_DOMAIN} Google account.
        </p>
        {denied && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            That account can&apos;t open the admin pages. Sign in with your @{STAFF_DOMAIN}{' '}
            account.
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            'use server'
            await signIn('google', { redirectTo })
          }}
        >
          <Button type="submit" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      </section>
    </main>
  )
}
