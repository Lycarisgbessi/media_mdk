// =====================================================================
// GET /api/audit — journal d'audit (admin, 200 dernières entrées)
// =====================================================================

import { db } from '@/lib/db'
import { jsonOk, requireStaff, ADMIN_ROLES } from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const guard = await requireStaff(ADMIN_ROLES)
  if (!guard.user) return guard.resp

  const { searchParams } = new URL(request.url)
  const rawLimit = parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 200 : rawLimit, 1), 500)

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })

  return jsonOk({ logs })
}
