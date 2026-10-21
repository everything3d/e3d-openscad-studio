import type { ReactNode } from 'react'
import { signOut } from '@/auth'

/** Title row with the signed-in staff account and a sign-out button. */
export function AdminHeader({
  email,
  title,
  children,
}: {
  email: string | null | undefined
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          E3D Studio · Admin
        </div>
        <h1 className="mt-1 truncate text-2xl font-semibold">{title}</h1>
        {children}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/admin' })
        }}
      >
        <span>{email}</span>
        <button type="submit" className="font-medium text-foreground hover:underline">
          Sign out
        </button>
      </form>
    </header>
  )
}
