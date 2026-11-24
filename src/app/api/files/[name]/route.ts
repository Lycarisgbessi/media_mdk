// =====================================================================
// /api/files/<nom> — sert les fichiers téléversés via /api/upload
// Lecture directe du dossier ./uploads avec garde anti-traversée et
// Content-Type déduit de l'extension (liste fermée).
// =====================================================================

import fs from 'fs/promises'
import path from 'path'
import { apiError, notFound } from '../../_lib/helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const EXT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

// Noms générés par /api/upload uniquement : alphanumériques, point, tiret.
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,150}$/i

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params

  if (!NAME_RE.test(name) || name.includes('..')) {
    return apiError('Nom de fichier invalide', 400)
  }

  const type = EXT_TYPE[name.split('.').pop()?.toLowerCase() ?? '']
  if (!type) return apiError('Type de fichier non pris en charge', 400)

  const full = path.join(UPLOAD_DIR, name)
  if (!full.startsWith(UPLOAD_DIR + path.sep)) {
    return apiError('Chemin invalide', 400)
  }

  try {
    const data = await fs.readFile(full)
    // Copie dans un Uint8Array standard (BodyInit sûr côté TypeScript).
    const bytes = new Uint8Array(data.byteLength)
    bytes.set(data)
    return new Response(bytes, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(data.byteLength),
        // Noms uniques à vie → cache agressif sans risque.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return notFound('Fichier introuvable')
  }
}
