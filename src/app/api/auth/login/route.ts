// =====================================================================
// POST /api/auth/login — connexion (mot de passe + 2FA démo si activé)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { publicUser, setSessionCookie, logAudit, verifyPassword } from '@/lib/auth'
import { apiError, badRequest, ok } from '@/app/api/_lib/helpers'
import { checkRate, clientIpHash } from '@/app/api/_lib/media-helpers'

export const dynamic = 'force-dynamic'

// Code 2FA de démonstration (cahier des charges)
const DEMO_2FA_CODE = '246810'

const schema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
  code: z.string().optional(),
})

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Email et mot de passe requis')
  const { email, password, code } = parsed.data

  // Anti force brute : max 8 tentatives / minute par IP, 5 par compte
  const ipKey = `login:ip:${clientIpHash(req)}`
  const emailKey = `login:email:${email.trim().toLowerCase()}`
  if (!checkRate(ipKey, 8, 60_000)) {
    return apiError('Trop de tentatives de connexion. Réessayez dans une minute.', 429)
  }
  if (!checkRate(emailKey, 5, 60_000)) {
    return apiError('Trop de tentatives pour ce compte. Réessayez dans une minute.', 429)
  }

  // Recherche du compte (actif, non supprimé) — insensible à la casse en secours
  let user = await db.user.findFirst({
    where: { email, deletedAt: null, status: 'active' },
  })
  if (!user) {
    user = await db.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null, status: 'active' },
    })
  }
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return apiError('Identifiants invalides', 401)
  }

  // Double authentification : demande du code puis vérification
  if (user.twofaEnabled) {
    if (!code) return apiError('2FA_REQUIRED', 401, { requires2fa: true })
    if (code !== DEMO_2FA_CODE) return apiError('Code 2FA invalide', 401)
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await setSessionCookie(user.id)
  await logAudit(updated, 'login', 'user', user.id, { email: user.email })

  return ok({ user: publicUser(updated) })
}
