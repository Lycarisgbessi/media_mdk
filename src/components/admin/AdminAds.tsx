'use client'

// =====================================================================
// AdminAds — régie publicitaire : emplacements, créations, annonceurs
// Données : GET /api/ads/admin → { slots, creatives, advertisers }
// Statistiques calculées côté client depuis les créatives
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Code2,
  Eye,
  Image as ImageIcon,
  Layers,
  MousePointerClick,
  Pencil,
  Percent,
  Plus,
  Trash2,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import type { AdCreativePayload, AdSlotPayload } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ConfirmAction,
  EmptyState,
  ListSkeleton,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  errMessage,
} from './admin-ui'

// ---------- Formes exactes renvoyées par GET /api/ads/admin ----------

type CreativeRow = AdCreativePayload & { slotName?: string | null }

interface AdvertiserRow {
  id: string
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  active: boolean
  createdAt?: string
}

interface AdsAdminData {
  slots: AdSlotPayload[]
  creatives: CreativeRow[]
  advertisers: AdvertiserRow[]
}

// ---------- Helpers ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  if (!value) return null // champ vide = date à effacer (null)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function ctrLabel(creative: CreativeRow): string {
  if (!creative.impressions || creative.impressions <= 0) return '—'
  return `${((creative.clicks / creative.impressions) * 100).toFixed(1).replace('.', ',')} %`
}

// =====================================================================
// Onglet Emplacements
// =====================================================================

function SlotsTab({
  slots,
  creatives,
  onChanged,
}: {
  slots: AdSlotPayload[] | null
  creatives: CreativeRow[]
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  const toggle = async (slot: AdSlotPayload, active: boolean) => {
    setBusyId(slot.id)
    try {
      await api.put(`/api/ads/admin/slots/${slot.id}`, { active })
      toast({ title: active ? 'Emplacement activé' : 'Emplacement désactivé', description: slot.name })
      onChanged()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  if (!slots) return <ListSkeleton rows={5} />
  if (slots.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Aucun emplacement"
        description="Les emplacements publicitaires (bannière, encarts…) sont créés lors de l'initialisation du site."
      />
    )
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto scroll-slim">
      {slots.map((slot) => {
        const activeCreatives = creatives.filter((c) => c.slotId === slot.id && c.active).length
        return (
          <SectionCard key={slot.id} contentClassName="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{slot.name}</p>
                  <Badge variant="secondary" className="text-[10px]">{slot.key}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {slot.placement}
                  {slot.width && slot.height ? ` · ${slot.width}×${slot.height} px` : ''}
                </p>
                <div className="mt-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {activeCreatives} création(s) active(s)
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Switch
                  checked={slot.active}
                  disabled={busyId === slot.id}
                  onCheckedChange={(v) => void toggle(slot, v)}
                  aria-label={`Emplacement ${slot.name} ${slot.active ? 'actif' : 'inactif'}`}
                />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {slot.active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          </SectionCard>
        )
      })}
    </div>
  )
}

// =====================================================================
// Onglet Créations
// =====================================================================

interface CreativeForm {
  id: string | null
  name: string
  slotId: string
  advertiserId: string
  format: 'image' | 'html'
  imageUrl: string
  htmlCode: string
  linkUrl: string
  weight: string
  active: boolean
  startsAt: string
  endsAt: string
}

const EMPTY_CREATIVE: CreativeForm = {
  id: null,
  name: '',
  slotId: '',
  advertiserId: '',
  format: 'image',
  imageUrl: '',
  htmlCode: '',
  linkUrl: '',
  weight: '1',
  active: true,
  startsAt: '',
  endsAt: '',
}

function CreativesTab({
  creatives,
  slots,
  advertisers,
  onChanged,
}: {
  creatives: CreativeRow[] | null
  slots: AdSlotPayload[]
  advertisers: AdvertiserRow[]
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreativeForm>(EMPTY_CREATIVE)

  const set = <K extends keyof CreativeForm>(key: K, value: CreativeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setForm({ ...EMPTY_CREATIVE, slotId: slots[0]?.id ?? '' })
    setDialogOpen(true)
  }

  const openEdit = (c: CreativeRow) => {
    setForm({
      id: c.id,
      name: c.name,
      slotId: c.slotId,
      advertiserId: c.advertiserId ?? '',
      // HTML prioritaire si présent (une créative peut avoir les deux via l'API)
      format: c.htmlCode ? 'html' : 'image',
      imageUrl: c.imageUrl ?? '',
      htmlCode: c.htmlCode ?? '',
      linkUrl: c.linkUrl ?? '',
      weight: String(c.weight ?? 1),
      active: c.active,
      startsAt: isoToLocalInput(c.startsAt),
      endsAt: isoToLocalInput(c.endsAt),
    })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' })
      return
    }
    if (!form.slotId) {
      toast({ title: 'Emplacement requis', variant: 'destructive' })
      return
    }
    if (form.format === 'image' && !form.imageUrl.trim()) {
      toast({ title: 'URL de l’image requise', variant: 'destructive' })
      return
    }
    if (form.format === 'html' && !form.htmlCode.trim()) {
      toast({ title: 'Code HTML requis', variant: 'destructive' })
      return
    }
    setSaving(true)
    const weight = form.weight === '' ? NaN : Number(form.weight)
    const payload = {
      name: form.name.trim(),
      slotId: form.slotId,
      advertiserId: form.advertiserId || null,
      imageUrl: form.format === 'image' ? form.imageUrl.trim() || null : null,
      htmlCode: form.format === 'html' ? form.htmlCode : null,
      // Le lien est utilisé par les deux formats (une créative HTML peut aussi cliquer)
      linkUrl: form.linkUrl.trim() || null,
      weight: Number.isFinite(weight) && weight >= 1 ? Math.floor(weight) : 1,
      active: form.active,
      startsAt: localInputToIso(form.startsAt),
      endsAt: localInputToIso(form.endsAt),
    }
    try {
      if (form.id) {
        await api.put(`/api/ads/admin/creatives/${form.id}`, payload)
        toast({ title: 'Création enregistrée', description: form.name.trim() })
      } else {
        await api.post('/api/ads/admin/creatives', payload)
        toast({ title: 'Création créée', description: form.name.trim() })
      }
      setDialogOpen(false)
      onChanged()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (c: CreativeRow) => {
    try {
      await api.del(`/api/ads/admin/creatives/${c.id}`)
      toast({ title: 'Création supprimée', description: c.name })
      onChanged()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nouvelle création
        </Button>
      </div>

      {!creatives ? (
        <ListSkeleton rows={6} />
      ) : creatives.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Aucune création publicitaire"
          description="Créez des bannières image ou des blocs HTML, associez-les à un emplacement et un annonceur."
          action={<Button onClick={openCreate}>Créer une création</Button>}
        />
      ) : (
        <div className="max-h-96 overflow-y-auto scroll-slim rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Emplacement</TableHead>
                <TableHead className="hidden lg:table-cell">Annonceur</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="hidden sm:table-cell">Poids</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Impr.</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Clics</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creatives.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-[180px] truncate font-medium">{c.name}</TableCell>
                  <TableCell className="hidden max-w-[160px] truncate md:table-cell">
                    {c.slotName ?? c.slotKey ?? '—'}
                  </TableCell>
                  <TableCell className="hidden max-w-[160px] truncate lg:table-cell">
                    {c.advertiserName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      {c.imageUrl ? (
                        <ImageIcon className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Code2 className="h-3 w-3" aria-hidden="true" />
                      )}
                      {c.imageUrl ? 'Image' : 'HTML'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums">{c.weight}</TableCell>
                  <TableCell>
                    {c.active ? (
                      <StatusBadge status="active" />
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums">{c.impressions}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums">{c.clicks}</TableCell>
                  <TableCell className="text-right tabular-nums">{ctrLabel(c)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => openEdit(c)}
                        aria-label={`Modifier ${c.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <ConfirmAction
                        title="Supprimer cette création ?"
                        description={`« ${c.name} » sera définitivement supprimée avec ses statistiques.`}
                        confirmLabel="Supprimer"
                        onConfirm={() => remove(c)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-rouge hover:text-rouge"
                            aria-label={`Supprimer ${c.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier la création' : 'Nouvelle création'}</DialogTitle>
            <DialogDescription>
              Bannière image ou bloc HTML, diffusée dans un emplacement selon un poids de tirage.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="creative-name">Nom</Label>
              <Input
                id="creative-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ex. Bannière Banque Nationale"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emplacement</Label>
              <Select value={form.slotId} onValueChange={(v) => set('slotId', v)}>
                <SelectTrigger aria-label="Emplacement"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Annonceur (optionnel)</Label>
              <Select value={form.advertiserId || 'none'} onValueChange={(v) => set('advertiserId', v === 'none' ? '' : v)}>
                <SelectTrigger aria-label="Annonceur"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {advertisers.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creative-weight">Poids de tirage</Label>
              <Input
                id="creative-weight"
                type="number"
                min={1}
                max={100}
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Format</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.format === 'image' ? 'default' : 'outline'}
                  className="min-h-[44px]"
                  onClick={() => set('format', 'image')}
                >
                  <ImageIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Image
                </Button>
                <Button
                  type="button"
                  variant={form.format === 'html' ? 'default' : 'outline'}
                  className="min-h-[44px]"
                  onClick={() => set('format', 'html')}
                >
                  <Code2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  HTML
                </Button>
              </div>
            </div>

            {form.format === 'image' ? (
              <>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="creative-image">URL de l’image</Label>
                  <Input
                    id="creative-image"
                    value={form.imageUrl}
                    onChange={(e) => set('imageUrl', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="sm:col-span-2">
                  {form.imageUrl.trim() ? (
                     
                    <img
                      src={form.imageUrl.trim()}
                      alt="Aperçu de la création"
                      className="max-h-32 w-auto rounded-lg border object-contain"
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Aperçu de l’image
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="creative-link">Lien de destination</Label>
                  <Input
                    id="creative-link"
                    value={form.linkUrl}
                    onChange={(e) => set('linkUrl', e.target.value)}
                    placeholder="https://annonceur.example"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="creative-html">Code HTML</Label>
                <Textarea
                  id="creative-html"
                  value={form.htmlCode}
                  onChange={(e) => set('htmlCode', e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder={'<a href="https://…"><img src="https://…" alt="Publicité" /></a>'}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="creative-starts">Début de diffusion (optionnel)</Label>
              <Input
                id="creative-starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creative-ends">Fin de diffusion (optionnel)</Label>
              <Input
                id="creative-ends"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Création active</p>
                <p className="text-xs text-muted-foreground">Seules les créations actives participent au tirage.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} aria-label="Création active" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button className="min-h-[44px]" disabled={saving} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer la création'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================================
// Onglet Annonceurs
// =====================================================================

interface AdvertiserForm {
  id: string | null
  name: string
  contactName: string
  email: string
  phone: string
  active: boolean
}

const EMPTY_ADVERTISER: AdvertiserForm = {
  id: null,
  name: '',
  contactName: '',
  email: '',
  phone: '',
  active: true,
}

function AdvertisersTab({
  advertisers,
  creatives,
  onChanged,
}: {
  advertisers: AdvertiserRow[] | null
  creatives: CreativeRow[]
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<AdvertiserForm>(EMPTY_ADVERTISER)

  const set = <K extends keyof AdvertiserForm>(key: K, value: AdvertiserForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setForm(EMPTY_ADVERTISER)
    setDialogOpen(true)
  }

  const openEdit = (a: AdvertiserRow) => {
    setForm({
      id: a.id,
      name: a.name,
      contactName: a.contactName ?? '',
      email: a.email ?? '',
      phone: a.phone ?? '',
      active: a.active,
    })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' })
      return
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      toast({ title: 'Email invalide', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      active: form.active,
    }
    try {
      if (form.id) {
        await api.put(`/api/ads/admin/advertisers/${form.id}`, payload)
        toast({ title: 'Annonceur enregistré', description: form.name.trim() })
      } else {
        await api.post('/api/ads/admin/advertisers', payload)
        toast({ title: 'Annonceur créé', description: form.name.trim() })
      }
      setDialogOpen(false)
      onChanged()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (a: AdvertiserRow) => {
    try {
      await api.del(`/api/ads/admin/advertisers/${a.id}`)
      toast({ title: 'Annonceur supprimé', description: a.name })
      onChanged()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nouvel annonceur
        </Button>
      </div>

      {!advertisers ? (
        <ListSkeleton rows={4} />
      ) : advertisers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun annonceur"
          description="Enregistrez les annonceurs pour suivre les créations associées et leurs contacts."
          action={<Button onClick={openCreate}>Ajouter un annonceur</Button>}
        />
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto scroll-slim">
          {advertisers.map((a) => {
            const attached = creatives.filter((c) => c.advertiserId === a.id).length
            return (
              <SectionCard key={a.id} contentClassName="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[a.contactName, a.email, a.phone].filter(Boolean).join(' · ') || 'Contact non renseigné'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {a.active ? (
                        <StatusBadge status="active" />
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">{attached} création(s)</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={() => openEdit(a)}
                      aria-label={`Modifier ${a.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <ConfirmAction
                      title="Supprimer cet annonceur ?"
                      description={
                        attached > 0
                          ? `${attached} création(s) lui sont attachée(s) : elles seront conservées mais détachées.`
                          : `« ${a.name} » sera définitivement supprimé.`
                      }
                      confirmLabel="Supprimer"
                      onConfirm={() => remove(a)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] text-rouge hover:text-rouge"
                          aria-label={`Supprimer ${a.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier l’annonceur' : 'Nouvel annonceur'}</DialogTitle>
            <DialogDescription>Nom de l’annonceur et coordonnées du contact commercial.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="advertiser-name">Nom</Label>
              <Input
                id="advertiser-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ex. Banque Nationale"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="advertiser-contact">Contact</Label>
              <Input
                id="advertiser-contact"
                value={form.contactName}
                onChange={(e) => set('contactName', e.target.value)}
                placeholder="Nom du contact"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="advertiser-email">Email</Label>
              <Input
                id="advertiser-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contact@annonceur.example"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="advertiser-phone">Téléphone</Label>
              <Input
                id="advertiser-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Annonceur actif</p>
                <p className="text-xs text-muted-foreground">Les annonceurs inactifs restent archivés dans la régie.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} aria-label="Annonceur actif" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button className="min-h-[44px]" disabled={saving} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer l’annonceur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================================
// Vue principale Publicité
// =====================================================================

export default function AdminAds() {
  const [data, setData] = useState<AdsAdminData | null>(null)
  const [tab, setTab] = useState('slots')

  const load = useCallback(() => {
    api
      .get<AdsAdminData>('/api/ads/admin')
      .then((d) =>
        setData({
          slots: d.slots ?? [],
          creatives: d.creatives ?? [],
          advertisers: d.advertisers ?? [],
        })
      )
      .catch(() => setData({ slots: [], creatives: [], advertisers: [] }))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const creatives = data?.creatives ?? []
    const impressions = creatives.reduce((sum, c) => sum + (c.impressions || 0), 0)
    const clicks = creatives.reduce((sum, c) => sum + (c.clicks || 0), 0)
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    return { impressions, clicks, ctr }
  }, [data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publicité"
        description="Emplacements, créations publicitaires et annonceurs."
      />

      {data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Eye} label="Impressions totales" value={totals.impressions} accent="marque" />
          <StatCard icon={MousePointerClick} label="Clics totaux" value={totals.clicks} accent="jaune" />
          <StatCard
            icon={Percent}
            label="CTR moyen"
            value={Math.round(totals.ctr)}
            hint={`${totals.ctr.toFixed(1).replace('.', ',')} % des impressions`}
            accent="rouge"
          />
        </div>
      ) : (
        <ListSkeleton rows={1} />
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="slots">Emplacements</TabsTrigger>
          <TabsTrigger value="creatives">Créations</TabsTrigger>
          <TabsTrigger value="advertisers">Annonceurs</TabsTrigger>
        </TabsList>
        <TabsContent value="slots" className="mt-4">
          <SlotsTab slots={data?.slots ?? null} creatives={data?.creatives ?? []} onChanged={load} />
        </TabsContent>
        <TabsContent value="creatives" className="mt-4">
          <CreativesTab
            creatives={data?.creatives ?? null}
            slots={data?.slots ?? []}
            advertisers={data?.advertisers ?? []}
            onChanged={load}
          />
        </TabsContent>
        <TabsContent value="advertisers" className="mt-4">
          <AdvertisersTab advertisers={data?.advertisers ?? null} creatives={data?.creatives ?? []} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
