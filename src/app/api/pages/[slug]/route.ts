// =====================================================================
// /api/pages/[slug]
// GET : page par slug (public)
// PUT : mise à jour (admin, rédacteur en chef)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import { ROLES_CONTENT, badRequest, forbidden, notFound, ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET — détail d'une page
// ---------------------------------------------------------------------
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const page = await db.page.findUnique({ where: { slug } })
  if (!page) return notFound('Page introuvable')
  return ok({ page })
}

// ---------------------------------------------------------------------
// PUT — mise à jour du contenu éditorial / SEO
// ---------------------------------------------------------------------
const updateSchema = z
  .object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    metaTitle: z.string().nullish(),
    metaDescription: z.string().nullish(),
  })
  .partial()

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { slug } = await ctx.params
  const existing = await db.page.findUnique({ where: { slug } })
  if (!existing) return notFound('Page introuvable')

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides')
  const data = parsed.data

  const updated = await db.page.update({
    where: { slug },
    data: {
      title: data.title,
      content: data.content,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
    },
  })

  await logAudit(user, 'page.update', 'page', updated.id, { slug: updated.slug })

  return ok({ page: updated })
}
