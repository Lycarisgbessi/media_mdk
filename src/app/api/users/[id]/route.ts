// =====================================================================
// PUT    /api/users/[id] — mise à jour d'un utilisateur (admin)
// DELETE /api/users/[id] — suppression logique (admin, pas soi-même)
// =====================================================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { hashPassword, logAudit, publicUser } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, ALL_ROLES, ADMIN_ROLES } from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  role: z.enum(ALL_ROLES).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  firstName: z.string().min(1, 'Prénom requis').max(80).optional(),
  lastName: z.string().min(1, 'Nom requis').max(80).optional(),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(128).optional(),
  twofaEnabled: z.boolean().optional(),
  bio: z.string().max(2000).nullish(),
  avatarUrl: z.string().max(500).nullish(),
})

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADMIN_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.user.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return apiError('Utilisateur introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  // Garde-fou anti-blocage : un admin ne peut ni se rétrograder,
  // ni se suspendre, ni se désactiver la 2FA lui-même (scénario « dernier admin »)
  if (id === user.id && (data.role !== undefined || data.status !== undefined)) {
    return apiError('Vous ne pouvez pas modifier votre propre rôle ou statut (utilisez un autre administrateur)', 409)
  }

  const patch: Prisma.UserUncheckedUpdateInput = {}
  if (data.role !== undefined) patch.role = data.role
  if (data.status !== undefined) patch.status = data.status
  if (data.firstName !== undefined) patch.firstName = data.firstName.trim()
  if (data.lastName !== undefined) patch.lastName = data.lastName.trim()
  if (data.twofaEnabled !== undefined) patch.twofaEnabled = data.twofaEnabled
  if (data.bio !== undefined) patch.bio = data.bio
  if (data.avatarUrl !== undefined) patch.avatarUrl = data.avatarUrl
  if (data.password !== undefined) patch.passwordHash = hashPassword(data.password)

  const updated = await db.user.update({ where: { id: existing.id }, data: patch })

  await logAudit(user, 'update', 'user', updated.id, {
    email: updated.email,
    role: updated.role,
    statut: updated.status,
    motDePasseModifie: data.password !== undefined,
  })
  return jsonOk({ user: publicUser(updated) })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADMIN_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  if (id === user.id) return apiError('Impossible de supprimer votre propre compte', 409)

  const existing = await db.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, email: true } })
  if (!existing) return apiError('Utilisateur introuvable', 404)

  await db.user.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
  await logAudit(user, 'delete', 'user', existing.id, { email: existing.email })
  return jsonOk({ ok: true })
}
