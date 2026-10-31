import Link from 'next/link'
import { auth, isStaff } from '@/auth'
import { listAllChats } from '@/lib/db/queries'
import { AdminHeader } from './admin-header'
import { fmtIst, relativeTime } from './format'
import { ownerEmails } from './owners'
import { SignInScreen } from './sign-in'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

type Props = { searchParams: Promise<{ error?: string; page?: string; user?: string }> }

function preview(text: string | null): string {
  const t = text?.trim().replace(/\s+/g, ' ')
  if (!t) return '—'
  return t.length > 120 ? `${t.slice(0, 120)}…` : t
}

export default async function AdminPage({ searchParams }: Props) {
  const { error, page: pageParam, user } = await searchParams
  const session = await auth()
  if (!isStaff(session)) return <SignInScreen denied={Boolean(error)} redirectTo="/admin" />

  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const { chats, total } = await listAllChats({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    userId: user,
  })
  const emails = await ownerEmails([...(user ? [user] : []), ...chats.map((c) => c.userId)])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (p: number) => {
    const params = new URLSearchParams()
    if (user) params.set('user', user)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/admin?${qs}` : '/admin'
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AdminHeader email={session?.user?.email} title="All chats">
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString('en-IN')} {total === 1 ? 'chat' : 'chats'}
            {user && (
              <>
                {' '}
                by <span className="text-foreground">{emails.get(user) ?? user}</span> ·{' '}
                <Link href="/admin" className="underline-offset-2 hover:underline">
                  show everyone
                </Link>
              </>
            )}
          </p>
        </AdminHeader>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="w-28 px-4 py-3 font-medium">Render</th>
                <th className="px-4 py-3 font-medium">Chat</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Messages</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {chats.map((chat) => (
                <tr key={chat.id} className="align-top hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/chats/${chat.id}`}
                      className="block aspect-[8/5] w-24 overflow-hidden rounded-md border bg-muted"
                    >
                      {chat.thumbnailAt ? (
                        <img
                          src={`/admin/chats/${chat.id}/thumbnail?v=${chat.thumbnailAt.getTime()}`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                          no render
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <Link
                      href={`/admin/chats/${chat.id}`}
                      className="font-medium hover:underline"
                    >
                      {chat.name}
                    </Link>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {preview(chat.firstPrompt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin?user=${encodeURIComponent(chat.userId)}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {emails.get(chat.userId) ?? chat.userId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {chat.messageCount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    <span title={fmtIst(chat.updatedAt)}>{relativeTime(chat.updatedAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {chats.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No chats yet.</p>
          )}
        </div>

        {pages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="hover:text-foreground hover:underline">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className="hover:text-foreground hover:underline">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  )
}
