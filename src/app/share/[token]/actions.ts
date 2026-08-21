'use server'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { importProjectShare } from '@/lib/db/queries'

export async function openSharedProject(token: string) {
  const returnBackUrl = `/share/${encodeURIComponent(token)}`
  const { userId, orgId, redirectToSignIn } = await auth()
  if (!userId) return redirectToSignIn({ returnBackUrl })

  const projectId = await importProjectShare(token, {
    userId,
    organizationId: orgId ?? null,
  })
  if (!projectId) redirect(returnBackUrl)

  redirect(`/studio?project=${encodeURIComponent(projectId)}`)
}
