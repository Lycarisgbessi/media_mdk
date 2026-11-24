// =====================================================================
// Helpers partagés — formatage, YouTube, SEO
// =====================================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

const STOP_WORDS_FR = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'a', 'au', 'aux', 'en',
  'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'the', 'of', 'to', 'in', 'is',
])

export function slugifySeo(text: string): string {
  return slugify(text)
    .split('-')
    .filter((w) => !STOP_WORDS_FR.has(w))
    .slice(0, 10)
    .join('-')
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDate(iso?: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', opts || { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return formatDate(iso, { day: 'numeric', month: 'short' })
}

export function readingTimeFromText(text: string): number {
  const words = text.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// ---------- YouTube ----------

export function parseYouTubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,20})/,
    /(?:youtu\.be\/)([\w-]{6,20})/,
    /(?:youtube\.com\/shorts\/)([\w-]{6,20})/,
    /(?:youtube\.com\/live\/)([\w-]{6,20})/,
    /(?:youtube\.com\/embed\/)([\w-]{6,20})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export function youtubeThumbnail(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

// ---------- Google Drive (module FM, §6.1) ----------

/**
 * Extrait l'identifiant de fichier d'un lien Google Drive quel que soit
 * son format : /file/d/<id>/view, /open?id=<id>, /uc?id=<id>…
 */
export function parseDriveFileId(url: string): string | null {
  if (!url) return null
  const m =
    url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/) ??
    url.match(/^([\w-]{28,})$/) // id brut collé directement
  return m ? m[1] : null
}

/**
 * Renvoie une URL réellement jouable par un <audio> :
 * - un lien Drive de partage (page HTML) est converti en téléchargement
 *   direct (uc?export=download) — sinon le lecteur échoue silencieusement ;
 * - un fichier local (/audio/…) ou une URL directe est renvoyée tel quel.
 */
export function drivePlayableUrl(url?: string | null, fileId?: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url) && /drive\.google\.com/i.test(url)) {
    // L'identifiant dérivé du lien collé prime toujours : c'est la source de
    // vérité la plus récente saisie par la rédaction. Un fileId stocké plus
    // ancien (champ séparé) ne doit pas masquer un lien Drive mis à jour.
    const id = parseDriveFileId(url) || fileId
    if (id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
    return url
  }
  return url
}

// ---------- Markdown minimal → HTML (éditeur d'articles) ----------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markdownToHtml(md: string): string {
  if (!md) return ''
  if (md.trimStart().startsWith('<')) return md // déjà HTML
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inList = false
  let inQuote = false

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }
  const closeQuote = () => {
    if (inQuote) {
      out.push('</blockquote>')
      inQuote = false
    }
  }

  const safeUrl = (u: string): string => {
    const unescaped = u.replace(/&amp;/g, '&')
    // Bloque les schémas dangereux (javascript:, data:…) dans les liens/images
    if (/^\s*(javascript|vbscript|data(?!\s*:\s*image\/))/i.test(unescaped)) return '#'
    return unescaped.replace(/"/g, '%22')
  }

  const inline = (s: string): string => {
    let r = escapeHtml(s)
    r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, href) => `<img src="${safeUrl(href)}" alt="${alt}" loading="lazy" />`)
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => `<a href="${safeUrl(href)}" target="_blank" rel="noopener">${text}</a>`)
    r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    r = r.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    r = r.replace(/`([^`]+)`/g, '<code>$1</code>')
    return r
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^###\s+/.test(line)) {
      closeList(); closeQuote()
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`)
    } else if (/^##\s+/.test(line)) {
      closeList(); closeQuote()
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`)
    } else if (/^#\s+/.test(line)) {
      closeList(); closeQuote()
      out.push(`<h2>${inline(line.replace(/^#\s+/, ''))}</h2>`)
    } else if (/^>\s?/.test(line)) {
      closeList()
      if (!inQuote) {
        out.push('<blockquote>')
        inQuote = true
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ''))}</p>`)
    } else if (/^[-*]\s+/.test(line)) {
      closeQuote()
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
    } else if (line.trim() === '') {
      closeList(); closeQuote()
    } else {
      closeList(); closeQuote()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList(); closeQuote()
  return out.join('\n')
}

// ---------- Comptage de mots (SEO) ----------

export function wordCount(mdOrHtml: string): number {
  return mdOrHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
}

// ---------- Score SEO (règles du cahier des charges §13.2) ----------

export interface SeoCheck {
  id: string
  label: string
  status: 'ok' | 'warn' | 'error'
  hint?: string
}

export interface SeoInput {
  title: string
  metaTitle: string
  metaDescription: string
  slug: string
  keyword: string
  content: string // markdown/html
  hasImage: boolean
  imageHasAlt: boolean
  categoryId: string | null
  hasInternalLink: boolean
  hasExternalLink: boolean
  kind: 'article' | 'audio' | 'video'
  hasTranscription: boolean
}

export function computeSeo(input: SeoInput): { score: number; checks: SeoCheck[] } {
  const checks: SeoCheck[] = []
  const kw = input.keyword.trim().toLowerCase()
  const metaTitle = (input.metaTitle || input.title).trim()
  const desc = input.metaDescription.trim()
  const plain = input.content.replace(/<[^>]*>/g, ' ').toLowerCase()
  const words = wordCount(input.content)
  const headings = (input.content.match(/<h[23][^>]*>|^#{2,3}\s+/gm) || []).length

  const add = (id: string, label: string, ok: boolean, warn = false, hint?: string) =>
    checks.push({ id, label, status: ok ? 'ok' : warn ? 'warn' : 'error', hint })

  add('title-length', 'Titre SEO entre 50 et 60 caractères', metaTitle.length >= 50 && metaTitle.length <= 60, metaTitle.length >= 40 && metaTitle.length <= 70, `Actuellement : ${metaTitle.length} caractères`)
  add('desc-length', 'Méta-description entre 120 et 160 caractères', desc.length >= 120 && desc.length <= 160, desc.length >= 80, `Actuellement : ${desc.length} caractères`)
  add('kw-title', 'Mot-clé présent dans le titre SEO', kw ? metaTitle.toLowerCase().includes(kw) : false)
  add('kw-desc', 'Mot-clé présent dans la méta-description', kw ? desc.toLowerCase().includes(kw) : false)
  add('kw-content', 'Mot-clé présent dans le début du contenu', kw ? plain.slice(0, 600).includes(kw) : false)
  add('kw-slug', 'Mot-clé présent dans le slug', kw ? input.slug.toLowerCase().includes(kw.split(' ')[0]) : false)
  add('length', input.kind === 'article' ? 'Contenu ≥ 300 mots' : 'Résumé / transcription fourni', input.kind === 'article' ? words >= 300 : !!input.hasTranscription, input.kind === 'article' ? words >= 150 : words >= 40, input.kind === 'article' ? `${words} mots` : 'Recommandé pour le référencement')
  add('structure', 'Intertitres présents (structure H2/H3)', headings >= 1, words > 200)
  add('image', 'Image principale renseignée', input.hasImage)
  add('alt', "Texte alternatif de l'image renseigné", input.hasImage ? input.imageHasAlt : true)
  add('category', 'Rubrique choisie', !!input.categoryId)
  add('links', 'Au moins un lien interne', input.hasInternalLink)
  add('ext-link', 'Lien externe fiable (recommandé)', input.hasExternalLink, true)

  const weights = { ok: 1, warn: 0.5, error: 0 }
  const total = checks.reduce((acc, c) => acc + weights[c.status], 0)
  const score = Math.round((total / checks.length) * 100)
  return { score, checks }
}
