// =====================================================================
// POST /api/ads/admin/advertisers — création d'un annonceur (staff pub)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, ADS_ROLES } from '../../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(150),
  contactName: z.string().max(150).nullish(),
  email: z.string().email('Email invalide').max(200).nullish(),
  phone: z.string().max(40).nullish(),
  active: z.boolean().optional(),
})

export async function POST(request: Request) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  const advertiser = await db.advertiser.create({
    data: {
      name: data.name,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      active: data.active ?? true,
    },
  })

  await logAudit(user, 'create', 'advertiser', advertiser.id, { name: advertiser.name })
  return jsonOk({ advertiser }, 201)
}
