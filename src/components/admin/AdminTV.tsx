'use client'

// =====================================================================
// AdminTV — module vidéo : bibliothèque de vidéos et directs (live)
// Aperçu YouTube automatique, workflow éditorial, transitions de direct
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Eye, Pencil, Plus, Radio, Trash2, Tv } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { CategoryPayload, LiveStreamPayload, VideoPayload } from '@/lib/types'
import { formatDateTime, formatDuration, parseYouTubeId, youtubeThumbnail } from '@/lib/helpers'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  ConfirmAction,
  EmptyState,
  ListSkeleton,
  PageHeader,
  SectionCard,
  StatusBadge,
  errMessage,
} from './admin-ui'

// ---------- Utilitaires dates (datetime-local <-> ISO) ----------

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

// ---------- Options ----------

const VIDEO_TYPE_OPTIONS = [
  { value: 'reportage', label: 'Reportage' },
  { value: 'replay', label: 'Replay' },
  { value: 'extrait', label: 'Extrait' },
] as const

const VIDEO_TYPE_LABELS: Record<string, string> = {
  reportage: 'Reportage',
  replay: 'Replay',
  extrait: 'Extrait',
}

const VIDEO_STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'review', label: 'En relecture' },
  { value: 'approved', label: 'Approuvé' },
  { value: 'scheduled', label: 'Planifié' },
  { value: 'published', label: 'Publié' },
  { value: 'archived', label: 'Archivé' },
] as const

function flattenCategories(list: CategoryPayload[]): CategoryPayload[] {
  const out: CategoryPayload[] = []
  for (const c of list) {
    out.push(c)
    if (c.children?.length) out.push(...flattenCategories(c.children))
  }
  return out
}

// =====================================================================
// Dialog vidéo (création + édition)
// =====================================================================

interface VideoForm {
  title: string
  youtubeUrl: string
  description: string
  type: string
  categoryId: string
  duration: string
  status: string
  publishedAt: string
  scheduledAt: string
  transcription: string
  metaTitle: string
  metaDescription: string
}

const EMPTY_VIDEO: VideoForm = {
  title: '',
  youtubeUrl: '',
  description: '',
  type: 'reportage',
  categoryId: '',
  duration: '',
  status: 'draft',
  publishedAt: '',
  scheduledAt: '',
  transcription: '',
  metaTitle: '',
  metaDescription: '',
}

function formFromVideo(v: VideoPayload): VideoForm {
  return {
    title: v.title,
    youtubeUrl: v.youtubeUrl,
    description: v.description ?? '',
    type: v.type || 'reportage',
    categoryId: v.categoryId ?? '',
    duration: v.duration != null ? String(v.duration) : '',
    status: v.status || 'draft',
    publishedAt: isoToLocalInput(v.publishedAt),
    scheduledAt: isoToLocalInput(v.scheduledAt),
    transcription: v.transcription ?? '',
    metaTitle: v.metaTitle ?? '',
    metaDescription: v.metaDescription ?? '',
  }
}

function VideoDialog({
  open,
  onOpenChange,
  video,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  video: VideoPayload | null
  categories: CategoryPayload[]
  onSaved: () => void
}) {
  const isEdit = !!video
  const { toast } = useToast()
  const [form, setForm] = useState<VideoForm>(EMPTY_VIDEO)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof VideoForm>(key: K, value: VideoForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Remplissage depuis la ligne de la liste (évite un GET qui incrémenterait les vues)
  useEffect(() => {
    if (!open) return
    setForm(video ? formFromVideo(video) : EMPTY_VIDEO)
    setSaving(false)
  }, [open, video])

  const youtubeId = parseYouTubeId(form.youtubeUrl.trim())

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Titre requis', variant: 'destructive' })
      return
    }
    if (!youtubeId) {
      toast({ title: 'URL YouTube invalide', variant: 'destructive' })
      return
    }
    setSaving(true)
    const publishedAt = localInputToIso(form.publishedAt)
    const scheduledAt = localInputToIso(form.scheduledAt)
    const payload = {
      title: form.title.trim(),
      youtubeUrl: form.youtubeUrl.trim(),
      description: form.description.trim() || null,
      type: form.type,
      categoryId: form.categoryId || null,
      duration: form.duration !== '' ? Math.max(0, Math.round(Number(form.duration))) : null,
      status: form.status,
      ...(publishedAt ? { publishedAt } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
      transcription: form.transcription.trim() || null,
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
    }
    try {
      if (video) {
        await api.put(`/api/videos/${video.id}`, payload)
        toast({ title: 'Vidéo enregistrée', description: payload.title })
      } else {
        await api.post('/api/videos', payload)
        toast({ title: 'Vidéo créée', description: payload.title })
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
          <DialogTitle>{isEdit ? 'Modifier la vidéo' : 'Nouvelle vidéo'}</DialogTitle>
          <DialogDescription>
            Lien YouTube, catégorie, publication et référencement de la vidéo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="video-title">Titre *</Label>
              <Input
                id="video-title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Titre de la vidéo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-url">URL YouTube *</Label>
              <Input
                id="video-url"
                value={form.youtubeUrl}
                onChange={(e) => set('youtubeUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {youtubeId ? (
                <img
                  src={youtubeThumbnail(youtubeId)}
                  alt="Aperçu YouTube"
                  loading="lazy"
                  className="aspect-video w-40 rounded-md border object-cover"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Liens acceptés : watch, youtu.be, shorts, live — la vignette est générée automatiquement.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-desc">Description</Label>
              <Textarea
                id="video-desc"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                placeholder="Résumé affiché sur la page de la vidéo."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VIDEO_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="video-duration">Durée (secondes)</Label>
                <Input
                  id="video-duration"
                  type="number"
                  min={0}
                  value={form.duration}
                  onChange={(e) => set('duration', e.target.value)}
                  placeholder="ex. 742"
                />
                <p className="text-xs text-muted-foreground">
                  {form.duration !== '' && Number(form.duration) > 0
                    ? `Affichée : ${formatDuration(Number(form.duration))}`
                    : 'Optionnel — utilisé sur la page TV.'}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIDEO_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="video-published">Publication</Label>
                <Input
                  id="video-published"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => set('publishedAt', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-scheduled">Planification</Label>
                <Input
                  id="video-scheduled"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => set('scheduledAt', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-transcript">Transcription</Label>
              <Textarea
                id="video-transcript"
                value={form.transcription}
                onChange={(e) => set('transcription', e.target.value)}
                rows={5}
                placeholder="Texte de la vidéo…"
              />
              <p className="text-xs text-muted-foreground">Accessibilité &amp; SEO.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-meta-title">Titre SEO</Label>
              <Input id="video-meta-title" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-meta-desc">Méta-description</Label>
              <Textarea
                id="video-meta-desc"
                value={form.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la vidéo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// Onglet Vidéos
// =====================================================================

function VideosTab() {
  const { toast } = useToast()
  const [videos, setVideos] = useState<VideoPayload[] | null>(null)
  const [categories, setCategories] = useState<CategoryPayload[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VideoPayload | null>(null)

  const load = useCallback(() => {
    api
      .get<{ videos: VideoPayload[] }>('/api/videos?limit=100&status=all')
      .then((d) => setVideos(d.videos ?? []))
      .catch((err: unknown) => {
        setVideos([])
        toast({ title: 'Chargement impossible', description: errMessage(err), variant: 'destructive' })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Rubriques chargées une seule fois pour le Select du dialog
  useEffect(() => {
    let cancelled = false
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories')
      .then((d) => {
        if (!cancelled) setCategories(flattenCategories(d.categories ?? []))
      })
      .catch(() => {
        // sans rubriques, le Select affiche simplement « — »
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remove = async (v: VideoPayload) => {
    try {
      await api.del(`/api/videos/${v.id}`)
      toast({ title: 'Vidéo supprimée', description: v.title })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="min-h-[44px]"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouvelle vidéo
        </Button>
      </div>

      <SectionCard
        title="Bibliothèque vidéo"
        description="Toutes les vidéos, tous statuts confondus."
        contentClassName="p-0"
      >
        {videos === null ? (
          <div className="p-4">
            <ListSkeleton rows={5} />
          </div>
        ) : videos.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Tv}
              title="Aucune vidéo"
              description="Ajoutez la première vidéo de la chaîne avec son lien YouTube."
            />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-slim">
            <ul className="divide-y">
              {videos.map((v) => (
                <li key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <img
                    src={v.thumbnailUrl || youtubeThumbnail(v.youtubeId)}
                    alt=""
                    loading="lazy"
                    className="h-12 w-20 shrink-0 rounded-md border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{v.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{VIDEO_TYPE_LABELS[v.type] ?? v.type}</span>
                      {v.category ? <span>· {v.category.name}</span> : null}
                      <span className="inline-flex items-center gap-1">
                        · <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {v.views.toLocaleString('fr-FR')}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={v.status} />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      title="Modifier"
                      aria-label="Modifier la vidéo"
                      onClick={() => {
                        setEditing(v)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-rouge hover:text-rouge"
                          title="Supprimer"
                          aria-label="Supprimer la vidéo"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      }
                      title="Supprimer cette vidéo ?"
                      description={`« ${v.title} » sera retirée du site (suppression logique — récupérable en base).`}
                      onConfirm={() => remove(v)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <VideoDialog open={open} onOpenChange={setOpen} video={editing} categories={categories} onSaved={load} />
    </div>
  )
}

// =====================================================================
// Dialog direct (création + édition)
// =====================================================================

interface LiveForm {
  title: string
  youtubeUrl: string
  description: string
  scheduledStart: string
  featured: boolean
}

const EMPTY_LIVE: LiveForm = { title: '', youtubeUrl: '', description: '', scheduledStart: '', featured: false }

function LiveDialog({
  open,
  onOpenChange,
  live,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  live: LiveStreamPayload | null
  onSaved: () => void
}) {
  const isEdit = !!live
  const { toast } = useToast()
  const [form, setForm] = useState<LiveForm>(EMPTY_LIVE)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof LiveForm>(key: K, value: LiveForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    if (!open) return
    setForm(
      live
        ? {
            title: live.title,
            youtubeUrl: live.youtubeUrl,
            description: live.description ?? '',
            scheduledStart: isoToLocalInput(live.scheduledStart),
            featured: live.featured,
          }
        : EMPTY_LIVE
    )
    setSaving(false)
  }, [open, live])

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Titre requis', variant: 'destructive' })
      return
    }
    if (!parseYouTubeId(form.youtubeUrl.trim())) {
      toast({ title: 'URL YouTube invalide', variant: 'destructive' })
      return
    }
    setSaving(true)
    const scheduledStart = localInputToIso(form.scheduledStart)
    const payload = {
      title: form.title.trim(),
      youtubeUrl: form.youtubeUrl.trim(),
      description: form.description.trim() || null,
      ...(scheduledStart ? { scheduledStart } : {}),
      featured: form.featured,
    }
    try {
      if (live) {
        await api.put(`/api/lives/${live.id}`, payload)
        toast({ title: 'Direct enregistré', description: payload.title })
      } else {
        await api.post('/api/lives', payload)
        toast({ title: 'Direct créé', description: payload.title })
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
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le direct' : 'Nouveau direct'}</DialogTitle>
          <DialogDescription>
            Programme un direct YouTube : il démarre depuis la liste avec « Passer en direct ».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="live-title">Titre *</Label>
            <Input
              id="live-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Titre du direct"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="live-url">URL YouTube *</Label>
            <Input
              id="live-url"
              value={form.youtubeUrl}
              onChange={(e) => set('youtubeUrl', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="live-desc">Description</Label>
            <Textarea
              id="live-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Chapô affiché sur la page du direct."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="live-start">Début programmé</Label>
              <Input
                id="live-start"
                type="datetime-local"
                value={form.scheduledStart}
                onChange={(e) => set('scheduledStart', e.target.value)}
              />
            </div>
            <div className="flex items-end pb-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  id="live-featured"
                  checked={form.featured}
                  onCheckedChange={(v) => set('featured', v)}
                />
                <Label htmlFor="live-featured">À la une</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le direct'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// Onglet Directs
// =====================================================================

function LivesTab() {
  const { toast } = useToast()
  const [lives, setLives] = useState<LiveStreamPayload[] | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LiveStreamPayload | null>(null)

  const load = useCallback(() => {
    api
      .get<{ lives: LiveStreamPayload[] }>('/api/lives?all=1')
      .then((d) => setLives(d.lives ?? []))
      .catch((err: unknown) => {
        setLives([])
        toast({ title: 'Chargement impossible', description: errMessage(err), variant: 'destructive' })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Transitions validées côté API : scheduled → live|cancelled, live → ended|cancelled
  const setStatus = async (
    live: LiveStreamPayload,
    status: 'live' | 'ended' | 'cancelled',
    title: string
  ) => {
    try {
      await api.patch(`/api/lives/${live.id}`, { status })
      toast({ title, description: live.title })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
    }
  }

  const remove = async (live: LiveStreamPayload) => {
    try {
      await api.del(`/api/lives/${live.id}`)
      toast({ title: 'Direct supprimé', description: live.title })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="min-h-[44px]"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouveau direct
        </Button>
      </div>

      <SectionCard
        title="Directs"
        description="En direct, programmés, terminés puis annulés."
        contentClassName="p-0"
      >
        {lives === null ? (
          <div className="p-4">
            <ListSkeleton rows={5} />
          </div>
        ) : lives.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Radio}
              title="Aucun direct"
              description="Programmez votre premier direct avec son lien YouTube."
            />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-slim">
            <ul className="divide-y">
              {lives.map((live) => (
                <li key={live.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{live.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {live.scheduledStart ? formatDateTime(live.scheduledStart) : 'Sans horaire'}
                      </span>
                      {live.featured ? <span className="font-medium text-marque">· À la une</span> : null}
                      <span className="inline-flex items-center gap-1">
                        · <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {live.views.toLocaleString('fr-FR')}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={live.status} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {live.status === 'scheduled' ? (
                      <>
                        <Button
                          size="sm"
                          className="min-h-[44px] bg-rouge text-white hover:bg-rouge/90"
                          onClick={() => void setStatus(live, 'live', 'Direct lancé')}
                        >
                          Passer en direct
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px]"
                          onClick={() => void setStatus(live, 'cancelled', 'Direct annulé')}
                        >
                          Annuler
                        </Button>
                      </>
                    ) : null}
                    {live.status === 'live' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => void setStatus(live, 'ended', 'Direct terminé')}
                      >
                        Terminer
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      title="Modifier"
                      aria-label="Modifier le direct"
                      onClick={() => {
                        setEditing(live)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-rouge hover:text-rouge"
                          title="Supprimer"
                          aria-label="Supprimer le direct"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      }
                      title="Supprimer ce direct ?"
                      description={`« ${live.title} » sera définitivement supprimé — action irréversible (pas de corbeille).`}
                      onConfirm={() => remove(live)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <LiveDialog open={open} onOpenChange={setOpen} live={editing} onSaved={load} />
    </div>
  )
}

// =====================================================================
// Page
// =====================================================================

export default function AdminTV() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chaîne TV"
        description="Bibliothèque vidéo et diffusion en direct du site public."
      />
      <Tabs defaultValue="videos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="videos" className="min-h-[44px]">Vidéos</TabsTrigger>
          <TabsTrigger value="lives" className="min-h-[44px]">Directs</TabsTrigger>
        </TabsList>
        <TabsContent value="videos">
          <VideosTab />
        </TabsContent>
        <TabsContent value="lives">
          <LivesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
