// =====================================================================
// GET /api/auth/me — utilisateur connecté (ou null)
// =====================================================================

import { getSessionUser, publicUser } from '@/lib/auth'
import { ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  return ok({ user: user ? publicUser(user) : null })
}
