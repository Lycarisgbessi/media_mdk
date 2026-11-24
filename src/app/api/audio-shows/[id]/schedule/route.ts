// =====================================================================
// PUT /api/audio-shows/[id]/schedule — remplace la grille de diffusion
// Body : { schedule: [{ day, time, recurrence, active }] }
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, DAYS_FR, AUDIO_ROLES } from '../../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const scheduleSchema = z.object({
  schedule: z
    .array(
      z.object({
        day: z.enum(DAYS_FR),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (format HH:mm)'),
        recurrence: z.enum(['daily', 'weekly', 'biweekly']).default('weekly'),
        active: z.boolean().default(true),
      })
    )
    .max(60),
})

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(AUDIO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const show = await db.audioShow.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true } })
  if (!show) return apiError('Émission introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(scheduleSchema, body)
  if (parsed.error) return parsed.error
  const rows = parsed.data.schedule

  await db.$transaction([
    db.audioSchedule.deleteMany({ where: { showId: show.id } }),
    db.audioSchedule.createMany({
      data: rows.map((row) => ({
        showId: show.id,
        day: row.day,
        time: row.time,
        recurrence: row.recurrence,
        active: row.active,
      })),
    }),
  ])

  await logAudit(user, 'update', 'audio_schedule', show.id, { show: show.name, creneaux: rows.length })
  return jsonOk({ ok: true })
}
