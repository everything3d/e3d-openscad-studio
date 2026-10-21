import { clerkClient } from '@clerk/nextjs/server'

/**
 * Clerk user id → primary email, for labelling chats on the staff desk.
 * Ids Clerk no longer knows (deleted accounts, the dev instance's users) are
 * simply missing from the map.
 */
export async function ownerEmails(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))]
  const emails = new Map<string, string>()
  if (!ids.length) return emails
  const clerk = await clerkClient()
  // getUserList takes at most 100 ids per call.
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await clerk.users.getUserList({ userId: ids.slice(i, i + 100), limit: 100 })
    for (const user of data) {
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress
      if (email) emails.set(user.id, email)
    }
  }
  return emails
}
