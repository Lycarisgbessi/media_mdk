// =====================================================================
// POST /api/auth/logout — déconnexion (suppression du cookie de session)
// =====================================================================

import { clearSessionCookie, getSessionUser, logAudit } from '@/lib/auth'
import { ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

export async function POST() {
  // Journalisation de la déconnexion (avant purge du cookie) — traçabilité §6
  const user = await getSessionUser()
  if (user) {
    try {
      await logAudit(user, 'logout', 'user', user.id, { email: user.email })
    } catch {
      // la déconnexion ne doit jamais échouer à cause de l'audit
    }
  }
  await clearSessionCookie()
  return ok({ ok: true })
}
