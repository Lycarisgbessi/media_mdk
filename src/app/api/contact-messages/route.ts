// =====================================================================
// GET /api/contact-messages — messagerie de contact (staff modération)
// =====================================================================

import { db } from '@/lib/db'
import { jsonOk, requireStaff, MODERATION_ROLES } from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const MESSAGE_STATUSES = ['new', 'read', 'answered', 'archived']

export async function GET(request: Request) {
  const guard = await requireStaff(MODERATION_ROLES)
  if (!guard.user) return guard.resp

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const where = status && MESSAGE_STATUSES.includes(status) ? { status } : {}
  const messages = await db.contactMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return jsonOk({ messages })
}
