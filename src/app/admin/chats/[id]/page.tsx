import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth, isStaff } from '@/auth'
import { CodeBlock } from '@/components/ai-elements/code-block'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { MessageParts } from '@/components/studio/message-parts'
import type { StudioUIMessage } from '@/lib/agents/studio-agent'
import { getChatForAdmin, getProjectMessages } from '@/lib/db/queries'
import { AdminHeader } from '../../admin-header'
import { fmtIst } from '../../format'
import { ownerEmails } from '../../owners'
import { SignInScreen } from '../../sign-in'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function AdminChatPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!isStaff(session)) return <SignInScreen denied={false} redirectTo={`/admin/chats/${id}`} />

  const [chat, messages] = await Promise.all([getChatForAdmin(id), getProjectMessages(id)])
  if (!chat) notFound()
  const email = (await ownerEmails([chat.userId])).get(chat.userId)

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← All chats
        </Link>
        <div className="mt-4">
          <AdminHeader email={session?.user?.email} title={chat.name}>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link
                href={`/admin?user=${encodeURIComponent(chat.userId)}`}
                className="text-foreground hover:underline"
              >
                {email ?? chat.userId}
              </Link>{' '}
              · started {fmtIst(chat.createdAt)} · last active {fmtIst(chat.updatedAt)}
            </p>
          </AdminHeader>
        </div>

        {chat.thumbnailAt && (
          <img
            src={`/admin/chats/${chat.id}/thumbnail?v=${chat.thumbnailAt.getTime()}`}
            alt={`Latest render of ${chat.name}`}
            className="mb-8 aspect-[8/5] w-full rounded-xl border bg-muted object-contain"
          />
        )}

        <div className="flex flex-col gap-8">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                <MessageParts message={message as StudioUIMessage} />
              </MessageContent>
            </Message>
          ))}
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages in this chat.</p>
          )}
        </div>

        <details className="mt-10 rounded-xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Current OpenSCAD code
          </summary>
          <div className="border-t p-3">
            <CodeBlock code={chat.code} language="openscad" />
          </div>
        </details>
      </div>
    </main>
  )
}
