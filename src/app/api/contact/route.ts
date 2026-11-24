// =====================================================================
// POST /api/contact — formulaire de contact public
//      rate limit : 5 messages/minute par IP (hachée)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { apiError, jsonOk, readJson, parseWith, checkRate, clientIpHash } from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const contactSchema = z.object({
  name: z.string().min(2, 'Nom requis (2 caractères minimum)').max(120),
  email: z.string().email('Email invalide').max(200),
  phone: z.string().max(40).nullish(),
  subject: z.string().min(1, 'Sujet requis').max(200),
  message: z.string().min(10, 'Message trop court (10 caractères minimum)').max(5000, 'Message trop long (5000 caractères maximum)'),
  attachmentUrl: z.string().max(500).nullish(),
  // Anti-spam : champ « website » (honeypot) + consentement RGPD obligatoire
  website: z.string().nullish(),
  consent: z.boolean().optional(),
})

export async function POST(request: Request) {
  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)

  // accepte les clés françaises (« nom », « sujet ») en secours
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : typeof body.nom === 'string' ? (body.nom as string).trim() : ''
  const subject =
    typeof body.subject === 'string' && body.subject.trim()
      ? body.subject.trim()
      : typeof body.sujet === 'string'
        ? (body.sujet as string).trim()
        : ''

  const parsed = parseWith(contactSchema, { ...body, name, subject })
  if (parsed.error) return parsed.error
  const data = parsed.data

  // Rate limit : max 5 messages/minute par IP (hachée)
  const ipHash = clientIpHash(request)
  if (!checkRate(`contact:${ipHash}`, 5, 60_000)) {
    return apiError('Trop de messages, patientez', 429)
  }

  // Honeypot : le champ « website » est invisible pour les humains — s'il est
  // rempli, c'est un robot. Réponse « ok » factice pour ne pas le renseigner.
  if (typeof data.website === 'string' && data.website.trim() !== '') {
    return jsonOk({ ok: true }, 201)
  }
  // Consentement RGPD obligatoire (§9.3)
  if (data.consent !== true) {
    return apiError('Le consentement de traitement des données est requis', 400)
  }

  await db.contactMessage.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase().trim(),
      phone: data.phone ?? null,
      subject: data.subject,
      message: data.message.trim(),
      attachmentUrl: data.attachmentUrl ?? null,
      status: 'new',
    },
  })

  return jsonOk({ ok: true }, 201)
}
