// =====================================================================
// Authentification serveur — sessions par cookie signé (HMAC), scrypt
// =====================================================================

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

/**
 * Secret de signature des sessions :
 * 1) variable d'environnement AUTH_SECRET (fichier .env — recommandé) ;
 * 2) à défaut, fichier .auth-secret généré une seule fois au premier démarrage ;
 * 3) en tout dernier recours, un secret éphémère (les sessions survivront
 *    uniquement au sein du même process).
 */
function loadSecret(): string {
  const fromEnv = process.env.AUTH_SECRET
  if (fromEnv && fromEnv.length >= 32) return fromEnv
  const file = path.join(process.cwd(), '.auth-secret')
  // 1) Un secret déjà généré dans le fichier ?
  try {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing.length >= 32) return existing
  } catch {
    // fichier absent : on tente de le créer ci-dessous
  }
  // 2) Génération + persistance (doit être tentée même si la lecture a échoué)
  try {
    const generated = crypto.randomBytes(48).toString('hex')
    fs.writeFileSync(file, generated, { mode: 0o600 })
    console.warn('[auth] AUTH_SECRET absent : secret généré dans .auth-secret (ajoutez AUTH_SECRET au .env pour la production)')
    return generated
  } catch (err) {
    console.warn('[auth] AUTH_SECRET absent et .auth-secret non accessible — secret éphémère utilisé (sessions invalidées au redémarrage).', err)
    return crypto.randomBytes(48).toString('hex')
  }
}

const SECRET = loadSecret()
export const SESSION_COOKIE = 'media_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 jours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(candidate, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex')
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now() + SESSION_TTL_MS}`
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expiry, signature] = parts
  const payload = `${userId}.${expiry}`
  const expected = sign(payload)
  const a = Buffer.from(signature, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  if (Number(expiry) < Date.now()) return null
  return userId
}

export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== '1',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const userId = verifySessionToken(token)
  if (!userId) return null
  const user = await db.user.findFirst({
    where: { id: userId, status: 'active', deletedAt: null },
  })
  return user
}

// Vérifie que l'utilisateur a un des rôles autorisés
export async function requireRole(roles: string[]) {
  const user = await getSessionUser()
  if (!user || !roles.includes(user.role)) return null
  return user
}

export function publicUser(user: {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  avatarUrl: string | null
  bio: string | null
  status: string
  twofaEnabled: boolean
  lastLoginAt: Date | null
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    status: user.status,
    twofaEnabled: user.twofaEnabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

export async function logAudit(user: { id: string; firstName: string; lastName: string } | null, action: string, entity: string, entityId?: string, data?: unknown) {
  await db.auditLog.create({
    data: {
      userId: user?.id ?? null,
      userName: user ? `${user.firstName} ${user.lastName}` : null,
      action,
      entity,
      entityId: entityId ?? null,
      data: data ? JSON.stringify(data) : null,
    },
  })
}

// Hash IP (RGPD) pour les commentaires
export function hashIp(ip: string | null): string {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 32)
}
