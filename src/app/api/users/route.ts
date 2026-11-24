// =====================================================================
// GET  /api/users — liste des utilisateurs (admin, triés rôle puis nom)
// POST /api/users — création d'un utilisateur (admin)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, logAudit, publicUser } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, ALL_ROLES, ROLE_ORDER, ADMIN_ROLES } from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  email: z.string().email('Email invalide').max(200),
  firstName: z.string().min(1, 'Prénom requis').max(80),
  lastName: z.string().min(1, 'Nom requis').max(80),
  role: z.enum(ALL_ROLES),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(128),
  twofaEnabled: z.boolean().optional(),
  bio: z.string().max(2000).nullish(),
  avatarUrl: z.string().max(500).nullish(),
})

export async function GET() {
  const guard = await requireStaff(ADMIN_ROLES)
  if (!guard.user) return guard.resp

  const users = await db.user.findMany({ where: { deletedAt: null } })

  // tri par rôle (ordre de la charte) puis nom de famille
  const sorted = [...users].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role)
    const rb = ROLE_ORDER.indexOf(b.role)
    const ca = ra === -1 ? ROLE_ORDER.length : ra
    const cb = rb === -1 ? ROLE_ORDER.length : rb
    if (ca !== cb) return ca - cb
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr')
  })

  return jsonOk({ users: sorted.map(publicUser) })
}

export async function POST(request: Request) {
  const guard = await requireStaff(ADMIN_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  const email = data.email.toLowerCase().trim()
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return apiError('Email déjà utilisé', 409)

  const created = await db.user.create({
    data: {
      email,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      role: data.role,
      passwordHash: hashPassword(data.password),
      twofaEnabled: data.twofaEnabled ?? false,
      bio: data.bio ?? null,
      avatarUrl: data.avatarUrl ?? null,
      status: 'active',
    },
  })

  await logAudit(user, 'create', 'user', created.id, { email: created.email, role: created.role })
  return jsonOk({ user: publicUser(created) }, 201)
}
