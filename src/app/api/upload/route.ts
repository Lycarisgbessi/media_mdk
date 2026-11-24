// =====================================================================
// /api/upload — téléversement de fichiers depuis l'appareil
// POST multipart/form-data { file } → { url, name, size, type }
//
// Utilisé par :
//  - l'éditeur d'article (import d'image dans le texte) ;
//  - l'import de l'image à la une ;
//  - toute image gérée dans l'espace pro (créatives pub, couvertures…).
//
// Les fichiers sont stockés dans ./uploads (hors public) et servis par
// la route /api/files/<nom> — aucune exposition directe du disque,
// aucun type non maîtrisé (SVG refusé : risque XSS).
// =====================================================================

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { getSessionUser } from '@/lib/auth'
import { apiError, ok } from '../_lib/helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 8 * 1024 * 1024 // 8 Mo

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function POST(req: Request) {
  // Tout membre du staff connecté peut téléverser une image
  // (journalistes, rédaction en chef, régies pub, audio/vidéo…).
  const user = await getSessionUser()
  if (!user) return apiError('Authentification requise', 401)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Envoi invalide : formulaire multipart attendu', 400)
  }

  const file = form.get('file')
  if (!(file instanceof File)) return apiError('Aucun fichier reçu', 400)
  if (file.size === 0) return apiError('Le fichier est vide', 400)
  if (file.size > MAX_SIZE) {
    return apiError('Image trop lourde (8 Mo maximum)', 413)
  }

  // L'extension est déduite du type MIME réel (jamais du nom d'origine) :
  // impossible de masquer un exécutable derrière une jolie extension.
  const ext = MIME_EXT[file.type]
  if (!ext) {
    return apiError('Format non pris en charge (JPEG, PNG, WebP, GIF ou AVIF)', 415)
  }

  const name = `${Date.now().toString(36)}-${crypto.randomUUID()}.${ext}`
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    await fs.writeFile(path.join(UPLOAD_DIR, name), buffer)
  } catch {
    return apiError('Stockage du fichier impossible', 500)
  }

  return ok({ url: `/api/files/${name}`, name, size: file.size, type: file.type }, 201)
}
