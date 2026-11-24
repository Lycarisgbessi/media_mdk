'use client'

// =====================================================================
// SharePanel — dialog « Partager ce contenu » : canaux sociaux, copie de
// lien, partage natif et génération de visuels Instagram/TikTok (canvas)
// =====================================================================

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Copy,
  Facebook,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
  Send,
  Share2,
  Twitter,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface SharePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  contentType: string
  contentId: string
}

interface Channel {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const CHANNELS: Channel[] = [
  { key: 'facebook', label: 'Facebook', icon: Facebook },
  { key: 'x', label: 'X', icon: Twitter },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'telegram', label: 'Telegram', icon: Send },
  { key: 'email', label: 'E-mail', icon: Mail },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'tiktok', label: 'TikTok', icon: Music2 },
]

const VISUAL_CHANNELS = new Set(['instagram', 'tiktok'])

/** URL de la page courante enrichie d'UTM (application mono-page). */
function buildUrl(origin: string, source: string): string {
  return `${origin}/?utm_source=${encodeURIComponent(source)}&utm_medium=social&utm_campaign=share`
}

/** Lien de partage propre à chaque canal. */
function shareLink(channel: string, origin: string, title: string): string {
  const url = encodeURIComponent(buildUrl(origin, channel))
  const text = encodeURIComponent(title)
  switch (channel) {
    case 'facebook':
      return `https://www.facebook.com/sharer.php?u=${url}`
    case 'x':
      return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    case 'whatsapp':
      return `https://wa.me/?text=${text}%20${url}`
    case 'telegram':
      return `https://t.me/share/url?url=${url}&text=${text}`
    case 'email':
      return `mailto:?subject=${text}&body=${url}`
    default:
      return buildUrl(origin, channel)
  }
}

/** Découpe le titre en lignes de largeur fixe (canvas), max `maxLines`. */
function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines) break
    } else {
      current = test
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  const hasMore = lines.length === maxLines && (current || words.length > 0)
  if (hasMore) {
    const last = lines[lines.length - 1] ?? ''
    lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 3))}…` : '…'
  }
  return lines
}

/** Génère un visuel 1080×1350 prêt à publier (fond vert, bande jaune). */
function drawShareVisual(siteName: string, title: string): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Fond dégradé vert foncé → vert
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350)
  gradient.addColorStop(0, '#85060C')
  gradient.addColorStop(1, '#BE070F')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1080, 1350)

  // Motif de points discret
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let y = 48; y < 1350; y += 52) {
    for (let x = 48; x < 1080; x += 52) {
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Médaillon logo
  ctx.fillStyle = '#F2C200'
  ctx.beginPath()
  ctx.arc(120, 170, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#85060C'
  ctx.font = 'bold 64px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('M', 120, 172)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // Titre (max 5 lignes, blanc gras)
  ctx.font = 'bold 72px Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#FFFFFF'
  const lines = wrapTitle(ctx, title || siteName, 940, 5)
  let ty = 340
  for (const line of lines) {
    ctx.fillText(line, 70, ty)
    ty += 92
  }

  // Bande jaune : siteName + mention media.fr
  ctx.fillStyle = '#F2C200'
  ctx.fillRect(0, 1150, 1080, 110)
  ctx.fillStyle = '#14181A'
  ctx.font = 'bold 46px Arial, Helvetica, sans-serif'
  ctx.fillText((siteName || 'MÉDIA').toUpperCase(), 70, 1216)
  ctx.textAlign = 'right'
  ctx.fillText('media.fr', 1010, 1216)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

export function SharePanel({ open, onOpenChange, title, contentType, contentId }: SharePanelProps) {
  const { toast } = useToast()
  const siteName = useAppStore((s) => s.settings?.siteName) || 'MÉDIA'
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  const trackShare = (channel: string) => {
    api
      .post('/api/share', { contentType, contentId, channel })
      .catch(() => {})
  }

  const handleChannel = (channel: Channel) => {
    if (VISUAL_CHANNELS.has(channel.key)) {
      trackShare(channel.key)
      try {
        const dataUrl = drawShareVisual(siteName, title)
        if (!dataUrl) throw new Error('canvas indisponible')
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = 'visuel-media.png'
        link.click()
        toast({ title: 'Visuel prêt à publier téléchargé' })
      } catch {
        toast({ title: 'Impossible de générer le visuel', variant: 'destructive' })
      }
      return
    }
    const link = shareLink(channel.key, origin || 'https://media.fr', title)
    trackShare(channel.key)
    if (channel.key === 'email') {
      window.location.href = link
    } else {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCopy = async () => {
    const url = buildUrl(origin, 'copie')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
      trackShare('copie')
    } catch {
      toast({ title: 'Copie impossible dans ce navigateur', variant: 'destructive' })
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, url: buildUrl(origin, 'natif') })
      trackShare('natif')
    } catch {
      // partage annulé par l'utilisateur
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Share2 className="h-5 w-5 text-marque" />
            Partager ce contenu
          </DialogTitle>
          <DialogDescription className="line-clamp-1 text-sm">{title}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {CHANNELS.map((channel, i) => (
            <motion.button
              key={channel.key}
              type="button"
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
              onClick={() => handleChannel(channel)}
              className="flex min-h-[44px] flex-col items-center gap-2 rounded-xl p-2 transition hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-marque"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-foreground/80 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <channel.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium">{channel.label}</span>
            </motion.button>
          ))}
        </div>

        <Separator className="my-2" />

        <div className="flex flex-col gap-2 sm:flex-row">
          {canNativeShare && (
            <Button variant="outline" onClick={handleNativeShare} className="h-11 flex-1 rounded-full">
              <Share2 className="h-4 w-4" />
              Partage natif
            </Button>
          )}
          <Button
            variant={copied ? 'default' : 'outline'}
            onClick={handleCopy}
            className={`h-11 flex-1 rounded-full transition-colors ${copied ? 'bg-marque text-white hover:bg-marque-fonce' : ''}`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Lien copié ✓' : 'Copier le lien'}
          </Button>
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Copy className="h-3 w-3" />
          Instagram &amp; TikTok : un visuel 1080×1350 prêt à publier est téléchargé.
        </p>
      </DialogContent>
    </Dialog>
  )
}

export default SharePanel
