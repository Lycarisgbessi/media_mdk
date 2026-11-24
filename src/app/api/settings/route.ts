// =====================================================================
// /api/settings — réglages du site
// GET (public) : réglages fusionnés + contact + réseaux + blocs d'accueil
// PUT (admin)  : upsert d'une section
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import { DEFAULT_SETTINGS, type ContactInfo, type SocialLink } from '@/lib/types'
import { ROLES_ADMIN, badRequest, forbidden, ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

const SETTING_SECTIONS = ['identity', 'colors', 'modules', 'general', 'seo', 'scripts', 'contact_infos', 'social_links'] as const

// ---------------------------------------------------------------------
// GET — fusionne les lignes SiteSetting par-dessus DEFAULT_SETTINGS
// ---------------------------------------------------------------------
export async function GET() {
  const rows = await db.siteSetting.findMany()
  const parsed: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      parsed[row.key] = JSON.parse(row.value)
    } catch {
      parsed[row.key] = row.value
    }
  }

  const pick = (key: string): Record<string, unknown> => {
    const v = parsed[key]
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    ...pick('identity'),
    ...pick('colors'),
    ...pick('modules'),
    ...pick('general'),
    ...pick('seo'),
    ...pick('scripts'),
  }

  const contactInfos = Array.isArray(parsed['contact_infos']) ? (parsed['contact_infos'] as ContactInfo[]) : []
  const socialLinks = Array.isArray(parsed['social_links']) ? (parsed['social_links'] as SocialLink[]) : []

  const homepageBlocks = await db.homepageBlock.findMany({ orderBy: { order: 'asc' } })

  return ok({ settings, contactInfos, socialLinks, homepageBlocks })
}

// ---------------------------------------------------------------------
// PUT — écriture d'une section (admin seul)
// ---------------------------------------------------------------------
const putSchema = z.object({
  section: z.enum(SETTING_SECTIONS),
  value: z.unknown(),
})

export async function PUT(req: Request) {
  const admin = await requireRole(ROLES_ADMIN)
  if (!admin) return forbidden('Réservé à l’administrateur')

  const parsed = putSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Section de réglages invalide')
  const { section, value } = parsed.data

  const json = JSON.stringify(value ?? null)
  await db.siteSetting.upsert({
    where: { key: section },
    update: { value: json },
    create: { key: section, value: json },
  })

  await logAudit(admin, 'settings.update', 'site_setting', section)

  return ok({ ok: true })
}
