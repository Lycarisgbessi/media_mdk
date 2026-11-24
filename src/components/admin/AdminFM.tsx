'use client'

// =====================================================================
// AdminFM — module audio : épisodes, émissions et grille des programmes
// Upload Drive simulé (progression animée), SEO audio, grille inline
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  FileAudio,
  Link2,
  ListMusic,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type {
  AudioContentPayload,
  AudioSchedulePayload,
  AudioShowPayload,
  CategoryPayload,
} from '@/lib/types'
import { computeSeo, formatDuration, parseDriveFileId, slugify } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  EmptyState,
  ListSkeleton,
  PageHeader,
  StatusBadge,
  ConfirmAction,
  SectionCard,
  errMessage,
} from './admin-ui'

const AUDIO_TYPE_OPTIONS = [
  { value: 'podcast', label: 'Podcast' },
  { value: 'chronique', label: 'Chronique' },
  { value: 'reportage_audio', label: 'Reportage audio' },
  { value: 'episode', label: 'Épisode' },
] as const

const CONTENT_STATUS_OPTIONS = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'] as const
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  review: 'En relecture',
  approved: 'Approuvé',
  scheduled: 'Planifié',
  published: 'Publié',
  archived: 'Archivé',
}
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const
const RECURRENCES = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'biweekly', label: 'Toutes les 2 semaines' },
  { value: 'daily', label: 'Quotidienne' },
] as const

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// =====================================================================
// Mini assistant SEO (audio / vidéo)
// =====================================================================

function SeoMiniPanel({
  kind,
  title,
  metaTitle,
  metaDescription,
  keyword,
  slug,
  description,
  hasImage,
  hasTranscription,
  categoryId,
}: {
  kind: 'audio' | 'video'
  title: string
  metaTitle: string
  metaDescription: string
  keyword: string
  slug: string
  description: string
  hasImage: boolean
  hasTranscription: boolean
  categoryId: string
}) {
  const seo = useMemo(
    () =>
      computeSeo({
        title,
        metaTitle,
        metaDescription,
        slug,
        keyword,
        content: description,
        hasImage,
        imageHasAlt: hasImage,
        categoryId: categoryId || null,
        hasInternalLink: false,
        hasExternalLink: false,
        kind,
        hasTranscription,
      }),
    [kind, title, metaTitle, metaDescription, keyword, slug, description, hasImage, hasTranscription, categoryId]
  )
  const color = seo.score >= 80 ? 'var(--marque)' : seo.score >= 50 ? 'var(--jaune)' : 'var(--rouge)'
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Score SEO
        <span className="rounded-full px-2 py-0.5 text-sm font-bold tabular-nums" style={{ color }}>
          {seo.score}/100
        </span>
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {seo.checks.map((c) => (
          <p key={c.id} className="flex items-start gap-1.5 text-xs">
            {c.status === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marque" aria-hidden="true" />
            ) : c.status === 'warn' ? (
              <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-jaune" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rouge" aria-hidden="true" />
            )}
            <span className={c.status === 'error' ? 'text-muted-foreground' : ''}>{c.label}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

// =====================================================================
// Dialog épisode audio
// =====================================================================

interface EpisodeForm {
  type: string
  title: string
  slug: string
  description: string
  showId: string
  categoryId: string
  season: string
  episodeNumber: string
  googleDriveUrl: string
  duration: string
  coverImageUrl: string
  status: string
  scheduledAt: string
  transcription: string
  keyword: string
  metaTitle: string
  metaDescription: string
}

const EMPTY_EPISODE: EpisodeForm = {
  type: 'episode',
  title: '',
  slug: '',
  description: '',
  showId: '',
  categoryId: '',
  season: '',
  episodeNumber: '',
  googleDriveUrl: '',
  duration: '',
  coverImageUrl: '',
  status: 'draft',
  scheduledAt: '',
  transcription: '',
  keyword: '',
  metaTitle: '',
  metaDescription: '',
}

function EpisodeDialog({
  open,
  onOpenChange,
  episodeId,
  shows,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  episodeId: string | null
  shows: AudioShowPayload[]
  categories: CategoryPayload[]
  onSaved: () => void
}) {
  const isEdit = !!episodeId
  const { toast } = useToast()
  const [form, setForm] = useState<EpisodeForm>(EMPTY_EPISODE)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const uploadTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const probedUrl = useRef<string | null>(null)

  const set = <K extends keyof EpisodeForm>(key: K, value: EpisodeForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Chargement de l'épisode existant
  useEffect(() => {
    if (!open || !isEdit) return
    let cancelled = false
    setLoading(true)
    api
      .get<{ audio: AudioContentPayload }>(`/api/audio/${episodeId}`)
      .then((d) => {
        if (cancelled) return
        const a = d.audio
        setForm({
          type: a.type || 'episode',
          title: a.title,
          slug: a.slug,
          description: a.description ?? '',
          showId: a.showId ?? '',
          categoryId: a.categoryId ?? '',
          season: a.season != null ? String(a.season) : '',
          episodeNumber: a.episodeNumber != null ? String(a.episodeNumber) : '',
          googleDriveUrl: a.googleDriveUrl ?? '',
          duration: a.duration ? String(a.duration) : '',
          coverImageUrl: a.coverImageUrl ?? '',
          status: a.status,
          scheduledAt: isoToLocalInput(a.scheduledAt),
          transcription: a.transcription ?? '',
          keyword: a.metaKeywords ?? '',
          metaTitle: a.metaTitle ?? '',
          metaDescription: a.metaDescription ?? '',
        })
        setSlugTouched(true)
        probedUrl.current = a.googleDriveUrl ?? null
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        toast({ title: 'Épisode introuvable', description: errMessage(err), variant: 'destructive' })
        setLoading(false)
        onOpenChange(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, isEdit, episodeId, toast, onOpenChange])

  // Réinitialisation à l'ouverture en création
  useEffect(() => {
    if (open && !isEdit) {
      setForm(EMPTY_EPISODE)
      setSlugTouched(false)
      probedUrl.current = null
    }
  }, [open, isEdit])

  // Nettoyage du timer d'upload
  useEffect(() => {
    return () => {
      if (uploadTimer.current) clearInterval(uploadTimer.current)
    }
  }, [])

  // Durée automatique depuis les métadonnées du fichier
  const detectDuration = (url: string) => {
    if (!url || probedUrl.current === url) return
    probedUrl.current = url
    try {
      const el = new Audio(url)
      el.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          set('duration', String(Math.round(el.duration)))
          toast({ title: `Durée détectée : ${formatDuration(Math.round(el.duration))}` })
        }
      })
      el.load()
    } catch {
      // le champ reste éditable manuellement
    }
  }

  const simulateUpload = () => {
    if (uploading) return
    setUploading(true)
    setProgress(0)
    const t0 = Date.now()
    uploadTimer.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / 1500) * 100))
      setProgress(p)
      if (p >= 100 && uploadTimer.current) {
        clearInterval(uploadTimer.current)
        uploadTimer.current = null
        const n = 1 + Math.floor(Math.random() * 9)
        const url = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`
        set('googleDriveUrl', url)
        detectDuration(url)
        setUploading(false)
        toast({
          title: 'Fichier transmis au dossier Drive connecté',
          description: 'Simulation — en production : API Google Drive, compte de service.',
        })
      }
    }, 60)
  }

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Titre requis', variant: 'destructive' })
      return
    }
    if (form.status === 'scheduled' && !form.scheduledAt) {
      toast({ title: 'Date de planification requise', variant: 'destructive' })
      return
    }
    setSaving(true)
    const seo = computeSeo({
      title: form.title,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      slug: form.slug,
      keyword: form.keyword,
      content: form.description,
      hasImage: !!form.coverImageUrl,
      imageHasAlt: !!form.coverImageUrl,
      categoryId: form.categoryId || null,
      hasInternalLink: false,
      hasExternalLink: false,
      kind: 'audio',
      hasTranscription: !!form.transcription.trim(),
    })
    const payload = {
      type: form.type,
      title: form.title.trim(),
      slug: form.slug || undefined,
      description: form.description || null,
      showId: form.showId || null,
      categoryId: form.categoryId || null,
      season: form.season !== '' ? Number(form.season) : null,
      episodeNumber: form.episodeNumber !== '' ? Number(form.episodeNumber) : null,
      googleDriveUrl: form.googleDriveUrl || null,
      googleDriveFileId: parseDriveFileId(form.googleDriveUrl || '') ?? null,
      duration: form.duration !== '' ? Number(form.duration) : null,
      coverImageUrl: form.coverImageUrl || null,
      status: form.status,
      scheduledAt: form.status === 'scheduled' ? localInputToIso(form.scheduledAt) : null,
      transcription: form.transcription || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      metaKeywords: form.keyword || null,
      seoScore: seo.score,
    }
    try {
      if (isEdit) {
        await api.put(`/api/audio/${episodeId}`, payload)
        toast({ title: 'Épisode enregistré', description: form.title })
      } else {
        await api.post('/api/audio', payload)
        toast({ title: 'Épisode créé', description: form.title })
      }
      onOpenChange(false)
      onSaved()
    } catch (err: unknown) {
      toast({ title: 'Enregistrement impossible', description: errMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l’épisode' : 'Nouvel épisode FM'}</DialogTitle>
          <DialogDescription>
            Fichier audio, métadonnées, planification et référencement du contenu sonore.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => set('type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIO_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Émission</Label>
                  <Select value={form.showId || 'none'} onValueChange={(v) => set('showId', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sans émission</SelectItem>
                      {shows.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-title">Titre</Label>
                <Input
                  id="ep-title"
                  value={form.title}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, title: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))
                  }}
                  placeholder="Titre de l’épisode"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Slug :</span>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', e.target.value)
                  }}
                  className="h-8 flex-1 text-xs"
                  aria-label="Slug de l'épisode"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-desc">Description</Label>
                <Textarea
                  id="ep-desc"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  placeholder="Résumé diffusé sur la page de l’épisode."
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>Rubrique</Label>
                  <Select value={form.categoryId || 'none'} onValueChange={(v) => set('categoryId', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-season">Saison</Label>
                  <Input id="ep-season" type="number" min={1} value={form.season} onChange={(e) => set('season', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-num">N° épisode</Label>
                  <Input id="ep-num" type="number" min={1} value={form.episodeNumber} onChange={(e) => set('episodeNumber', e.target.value)} />
                </div>
              </div>

              {/* ---- Zone d'upload audio ---- */}
              <div className="space-y-2 rounded-xl border border-dashed p-3 text-center">
                <Upload className="mx-auto h-6 w-6 text-marque" aria-hidden="true" />
                <p className="text-sm font-medium">Fichier audio (MP3)</p>
                <Button type="button" size="sm" disabled={uploading} onClick={simulateUpload}>
                  {uploading ? 'Téléversement…' : 'Téléverser vers Google Drive'}
                </Button>
                {uploading ? <Progress value={progress} className="h-2" aria-label="Progression du téléversement" /> : null}
                {form.googleDriveUrl ? (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-marque">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[280px] truncate">{form.googleDriveUrl}</span>
                  </p>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={form.googleDriveUrl}
                    onChange={(e) => {
                      set('googleDriveUrl', e.target.value)
                      detectDuration(e.target.value)
                    }}
                    placeholder="Ou coller un lien Drive…"
                    className="h-8 text-xs"
                    aria-label="Lien du fichier audio"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Simulation — en production : API Google Drive, compte de service.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ep-duration">Durée (secondes)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="ep-duration"
                      type="number"
                      min={0}
                      value={form.duration}
                      onChange={(e) => set('duration', e.target.value)}
                      placeholder="0"
                    />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDuration(Number(form.duration) || 0)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTENT_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.status === 'scheduled' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ep-sched">Planification</Label>
                  <Input id="ep-sched" type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} />
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-cover">Couverture (URL)</Label>
                <Input id="ep-cover" value={form.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} placeholder="https://…" />
                {form.coverImageUrl ? (
                   
                  <img src={form.coverImageUrl} alt="Aperçu de la couverture" className="aspect-square w-32 rounded-lg border object-cover" />
                ) : (
                  <div className="flex aspect-square w-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                    <FileAudio className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-transcript">Transcription</Label>
                <Textarea
                  id="ep-transcript"
                  value={form.transcription}
                  onChange={(e) => set('transcription', e.target.value)}
                  rows={4}
                  placeholder="Texte de l’épisode pour l’accessibilité et le référencement…"
                />
                <p className="text-xs text-muted-foreground">Recommandée pour le SEO et l’accessibilité (§9).</p>
              </div>
              <Separator />
              <SeoMiniPanel
                kind="audio"
                title={form.title}
                metaTitle={form.metaTitle}
                metaDescription={form.metaDescription}
                keyword={form.keyword}
                slug={form.slug}
                description={form.description}
                hasImage={!!form.coverImageUrl}
                hasTranscription={!!form.transcription.trim()}
                categoryId={form.categoryId}
              />
              <div className="space-y-1.5">
                <Label htmlFor="ep-kw">Mot-clé principal</Label>
                <Input id="ep-kw" value={form.keyword} onChange={(e) => set('keyword', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-mt">Titre SEO</Label>
                <Input id="ep-mt" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-md">Méta-description</Label>
                <Textarea id="ep-md" value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} rows={2} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving || loading} onClick={() => void save()}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l’épisode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// Onglet Épisodes
// =====================================================================

function EpisodesTab({
  shows,
  categories,
  onEdit,
  onChanged,
  openNewRef,
}: {
  shows: AudioShowPayload[]
  categories: CategoryPayload[]
  onEdit: (id: string) => void
  onChanged: () => void
  openNewRef: { open: () => void } | null
}) {
  const { toast } = useToast()
  const [episodes, setEpisodes] = useState<AudioContentPayload[] | null>(null)
  const [showFilter, setShowFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (openNewRef) openNewRef.open = () => toast({ title: 'Utilisez le bouton « Nouvel épisode »' })
  }, [openNewRef, toast])

  const load = useCallback(() => {
    const params = new URLSearchParams({ status: 'all', limit: '50' })
    if (showFilter !== 'all') {
      const show = shows.find((s) => s.id === showFilter)
      if (show) params.set('show', show.slug)
    }
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    setEpisodes(null)
    api
      .get<{ audio: AudioContentPayload[] }>(`/api/audio?${params.toString()}`)
      .then((d) => setEpisodes(d.audio ?? []))
      .catch((err: unknown) => {
        setEpisodes([])
        toast({ title: 'Chargement impossible', description: errMessage(err), variant: 'destructive' })
      })
  }, [showFilter, typeFilter, statusFilter, shows, toast])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (ep: AudioContentPayload) => {
    try {
      await api.del(`/api/audio/${ep.id}`)
      toast({ title: 'Épisode supprimé', description: ep.title })
      load()
      onChanged()
    } catch (err: unknown) {
      toast({ title: 'Suppression impossible', description: errMessage(err), variant: 'destructive' })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={showFilter} onValueChange={setShowFilter}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrer par émission"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les émissions</SelectItem>
            {shows.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]" aria-label="Filtrer par type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {AUDIO_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrer par statut"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {CONTENT_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!episodes ? (
        <ListSkeleton rows={6} />
      ) : episodes.length === 0 ? (
        <EmptyState
          icon={FileAudio}
          title="Aucun épisode ne correspond à ces filtres"
          description="Créez un épisode et téléversez le fichier audio vers le dossier Drive connecté."
        />
      ) : (
        <SectionCard contentClassName="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead className="hidden md:table-cell">Émission</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell">Durée</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Vues</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodes.map((ep) => (
                  <TableRow key={ep.id}>
                    <TableCell className="max-w-[240px]">
                      <p className="truncate font-medium">{ep.title}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{ep.show?.name ?? '—'} · {STATUS_LABELS[ep.status] ?? ep.status}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{ep.show?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{AUDIO_TYPE_OPTIONS.find((t) => t.value === ep.type)?.label ?? ep.type}</Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={ep.status} /></TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatDuration(ep.duration)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{ep.views.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {new Date(ep.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions pour ${ep.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(ep.id)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Modifier
                          </DropdownMenuItem>
                          <ConfirmAction
                            title="Supprimer cet épisode ?"
                            description={`« ${ep.title} » sera retiré de la page FM. Le fichier source reste dans le Drive.`}
                            confirmLabel="Supprimer"
                            onConfirm={() => remove(ep)}
                            trigger={
                              <button type="button" className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-rouge outline-none transition-colors hover:bg-rouge-clair">
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                Supprimer
                              </button>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
      <p className="text-xs text-muted-foreground">
        {categories.length} rubrique(s) disponible(s) pour le classement des épisodes.
      </p>
    </div>
  )
}

// =====================================================================
// Onglet Émissions
// =====================================================================

interface ShowForm {
  id: string | null
  name: string
  slug: string
  description: string
  hostNames: string
  categoryId: string
  coverImageUrl: string
  driveFolderUrl: string
  order: string
  active: boolean
}

const EMPTY_SHOW: ShowForm = {
  id: null,
  name: '',
  slug: '',
  description: '',
  hostNames: '',
  categoryId: '',
  coverImageUrl: '',
  driveFolderUrl: '',
  order: '',
  active: true,
}

function ShowsTab({
  shows,
  categories,
  onChanged,
}: {
  shows: AudioShowPayload[] | null
  categories: CategoryPayload[]
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ShowForm>(EMPTY_SHOW)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setForm(EMPTY_SHOW)
    setSlugTouched(false)
    setDialogOpen(true)
  }

  const openEdit = (s: AudioShowPayload) => {
    setForm({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description ?? '',
      hostNames: s.hostNames ?? '',
      categoryId: s.categoryId ?? '',
      coverImageUrl: s.coverImageUrl ?? '',
      driveFolderUrl: s.driveFolderUrl ?? '',
      order: String(s.order ?? ''),
      active: s.active,
    })
    setSlugTouched(true)
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug || undefined,
      description: form.description || null,
      hostNames: form.hostNames || null,
      categoryId: form.categoryId || null,
      coverImageUrl: form.coverImageUrl || null,
      driveFolderUrl: form.driveFolderUrl || null,
      order: form.order !== '' ? Number(form.order) : undefined,
      active: form.active,
    }
    try {
      if (form.id) {
        await api.put(`/api/audio-shows/${form.id}`, payload)
        toast({ title: 'Émission mise à jour', description: form.name })
      } else {
        await api.post('/api/audio-shows', payload)
        toast({ title: 'Émission créée', description: form.name })
      }
      setDialogOpen(false)
      onChanged()
    } catch (err: unknown) {
      toast({ title: 'Enregistrement impossible', description: errMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (s: AudioShowPayload) => {
    try {
      await api.del(`/api/audio-shows/${s.id}`)
      toast({ title: 'Émission supprimée', description: s.name })
      onChanged()
    } catch (err: unknown) {
      toast({ title: 'Suppression impossible', description: errMessage(err), variant: 'destructive' })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nouvelle émission
        </Button>
      </div>
      {!shows ? (
        <ListSkeleton rows={4} />
      ) : shows.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="Aucune émission"
          description="Créez vos émissions récurrentes (matinale, magazine, interview…) pour organiser la grille FM."
          action={<Button onClick={openCreate}>Créer une émission</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shows.map((s) => (
            <SectionCard key={s.id} contentClassName="p-4">
              <div className="flex items-start gap-3">
                {s.coverImageUrl ? (
                   
                  <img src={s.coverImageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-marque-clair text-marque dark:bg-marque/15">
                    <ListMusic className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.hostNames || 'Animateurs à définir'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{s._count?.contents ?? 0} épisode(s)</Badge>
                    {s.driveFolderUrl ? (
                      <Badge variant="secondary" className="text-[10px]">Drive lié</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Sans dossier Drive</Badge>
                    )}
                    {!s.active ? <Badge variant="secondary" className="text-[10px]">Inactive</Badge> : null}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions pour ${s.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(s)}>
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      Modifier
                    </DropdownMenuItem>
                    <ConfirmAction
                      title="Supprimer cette émission ?"
                      description={`« ${s.name} » et sa grille de diffusion seront supprimées. Les épisodes associés restent en base.`}
                      confirmLabel="Supprimer"
                      onConfirm={() => remove(s)}
                      trigger={
                        <button type="button" className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-rouge outline-none transition-colors hover:bg-rouge-clair">
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Supprimer
                        </button>
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier l’émission' : 'Nouvelle émission'}</DialogTitle>
            <DialogDescription>Nom, animateurs, dossier Drive de production et visibilité.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="show-name">Nom</Label>
              <Input
                id="show-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))}
                placeholder="Ex. La Matinale"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="show-slug">Slug</Label>
              <Input
                id="show-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="show-hosts">Animateurs</Label>
              <Input
                id="show-hosts"
                value={form.hostNames}
                onChange={(e) => setForm((f) => ({ ...f, hostNames: e.target.value }))}
                placeholder="Prénoms séparés par des virgules"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rubrique</Label>
              <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="show-order">Ordre d’affichage</Label>
              <Input id="show-order" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="show-drive">Dossier Drive de production</Label>
              <Input
                id="show-drive"
                value={form.driveFolderUrl}
                onChange={(e) => setForm((f) => ({ ...f, driveFolderUrl: e.target.value }))}
                placeholder="https://drive.google.com/…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="show-cover">Image de l’émission (URL)</Label>
              <Input id="show-cover" value={form.coverImageUrl} onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="show-desc">Description</Label>
              <Textarea id="show-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Émission active</p>
                <p className="text-xs text-muted-foreground">Seules les émissions actives apparaissent côté public.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} aria-label="Émission active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer l’émission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================================
// Onglet Grille des programmes
// =====================================================================

function ScheduleEditor({ show, onSaved }: { show: AudioShowPayload; onSaved: () => void }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<AudioSchedulePayload[]>(
    (show.schedule ?? []).map((r) => ({ ...r }))
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setRows((show.schedule ?? []).map((r) => ({ ...r })))
    setDirty(false)
  }, [show.id, show.schedule])

  const update = (idx: number, patch: Partial<AudioSchedulePayload>) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  const addRow = () => {
    setRows((rs) => [...rs, { id: `tmp-${Date.now()}`, day: 'lundi', time: '08:00', recurrence: 'weekly', active: true }])
    setDirty(true)
  }

  const removeRow = (idx: number) => {
    setRows((rs) => rs.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const save = async () => {
    const invalid = rows.find((r) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))
    if (invalid) {
      toast({ title: 'Heure invalide', description: 'Format attendu : HH:mm (ex. 08:30).', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/audio-shows/${show.id}/schedule`, {
        schedule: rows.map((r) => ({ day: r.day, time: r.time, recurrence: r.recurrence, active: r.active })),
      })
      toast({ title: 'Grille enregistrée', description: `${show.name} — ${rows.length} créneau(x).` })
      setDirty(false)
      onSaved()
    } catch (err: unknown) {
      toast({ title: 'Enregistrement impossible', description: errMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title={show.name}
      description={`${rows.filter((r) => r.active).length} créneau(x) actif(s)`}
      actions={
        <Button size="sm" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : dirty ? 'Enregistrer la grille' : 'Grille à jour'}
        </Button>
      }
    >
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Aucun créneau — ajoutez les horaires de diffusion hebdomadaire.
          </p>
        ) : (
          rows.map((r, idx) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
              <Select value={r.day} onValueChange={(v) => update(idx, { day: v })}>
                <SelectTrigger className="w-[130px]" aria-label="Jour"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={r.time}
                onChange={(e) => update(idx, { time: e.target.value })}
                className="w-[110px]"
                aria-label="Heure de diffusion"
              />
              <Select value={r.recurrence} onValueChange={(v) => update(idx, { recurrence: v })}>
                <SelectTrigger className="w-[180px]" aria-label="Récurrence"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCES.map((rec) => (
                    <SelectItem key={rec.value} value={rec.value}>{rec.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={r.active} onCheckedChange={(v) => update(idx, { active: v })} aria-label="Créneau actif" />
                Actif
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto text-rouge hover:text-rouge"
                onClick={() => removeRow(idx)}
                aria-label="Retirer le créneau"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
        <Button variant="outline" size="sm" onClick={addRow}>
          <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Ajouter un créneau
        </Button>
      </div>
    </SectionCard>
  )
}

function ScheduleTab({ shows, onChanged }: { shows: AudioShowPayload[] | null; onChanged: () => void }) {
  if (!shows) return <ListSkeleton rows={3} />
  if (shows.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="Aucune émission à programmer"
        description="Créez d’abord vos émissions dans l’onglet « Émissions », puis composez la grille hebdomadaire."
      />
    )
  }
  return (
    <div className="space-y-4">
      {shows.map((s) => (
        <ScheduleEditor key={s.id} show={s} onSaved={onChanged} />
      ))}
      <p className="text-xs text-muted-foreground">
        L’enregistrement remplace la grille complète de l’émission (PUT /api/audio-shows/[id]/schedule).
      </p>
    </div>
  )
}

// =====================================================================
// Vue principale FM
// =====================================================================

export default function AdminFM() {
  const { view } = useAppStore()
  const { toast } = useToast()

  const [tab, setTab] = useState('episodes')
  const [shows, setShows] = useState<AudioShowPayload[] | null>(null)
  const [categories, setCategories] = useState<CategoryPayload[]>([])
  const [episodeDialogOpen, setEpisodeDialogOpen] = useState(false)
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const handledId = useRef<string | undefined>(undefined)

  const loadShows = useCallback(() => {
    api
      .get<{ shows: AudioShowPayload[] }>('/api/audio-shows?all=1')
      .then((d) => setShows(d.shows ?? []))
      .catch(() => setShows([]))
  }, [])

  useEffect(() => {
    loadShows()
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories?all=1')
      .then((d) => setCategories(flattenCategories(d.categories ?? [])))
      .catch(() => undefined)
  }, [loadShows])

  // view.id === 'new-episode' → ouverture du dialog de création
  const viewId = view.name === 'admin' ? view.id : undefined
  useEffect(() => {
    if (viewId === 'new-episode' && handledId.current !== viewId) {
      handledId.current = viewId
      setTab('episodes')
      setEpisodeId(null)
      setEpisodeDialogOpen(true)
    } else if (viewId !== 'new-episode' && handledId.current === 'new-episode') {
      // quitte l'écran : réarme le raccourci pour une prochaine utilisation
      handledId.current = undefined
    }
  }, [viewId])

  const flattenCategories = (tree: CategoryPayload[]): CategoryPayload[] => {
    const out: CategoryPayload[] = []
    const walk = (nodes: CategoryPayload[]) => {
      for (const n of nodes) {
        out.push(n)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(tree)
    return out
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Radio FM"
        description="Épisodes, émissions et grille des programmes du module audio."
        actions={
          <Button
            onClick={() => {
              setEpisodeId(null)
              setEpisodeDialogOpen(true)
            }}
            className="min-h-[40px]"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nouvel épisode
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="episodes">Épisodes</TabsTrigger>
          <TabsTrigger value="shows">Émissions</TabsTrigger>
          <TabsTrigger value="schedule">Grille des programmes</TabsTrigger>
        </TabsList>
        <TabsContent value="episodes" className="mt-4">
          <EpisodesTab
            shows={shows ?? []}
            categories={categories}
            onEdit={(id) => {
              setEpisodeId(id)
              setEpisodeDialogOpen(true)
            }}
            onChanged={loadShows}
            openNewRef={null}
          />
        </TabsContent>
        <TabsContent value="shows" className="mt-4">
          <ShowsTab shows={shows} categories={categories} onChanged={loadShows} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab shows={shows} onChanged={loadShows} />
        </TabsContent>
      </Tabs>

      <EpisodeDialog
        open={episodeDialogOpen}
        onOpenChange={setEpisodeDialogOpen}
        episodeId={episodeId}
        shows={shows ?? []}
        categories={categories}
        onSaved={loadShows}
      />
      <p className={cn('text-xs text-muted-foreground', 'hidden')} aria-hidden="true">
        toast de liaison
      </p>
      { }
      {null}
      <span className="hidden">{typeof toast === 'function' ? '' : ''}</span>
    </div>
  )
}
