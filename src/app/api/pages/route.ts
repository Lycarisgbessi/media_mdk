// =====================================================================
// GET /api/pages — toutes les pages institutionnelles (triées par slug)
// =====================================================================

import { db } from '@/lib/db'
import { ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const pages = await db.page.findMany({ orderBy: { slug: 'asc' } })
  return ok({ pages })
}
