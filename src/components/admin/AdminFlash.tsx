'use client'

// =====================================================================
// AdminFlash — bandeau d'informations flash du site public
// Niveaux info/urgent/live, fenêtre de diffusion, activation instantanée
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { Info, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { FlashInfoPayload } from '@/lib/types'
import { formatDateTime, timeAgo } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  errMessage,
} from './admin-ui'

// L'API renvoie les lignes Prisma brutes : createdAt est présent en plus du payload partagé
type FlashRow = FlashInfoPayload & { createdAt?: string | null }

const LEVELS = [
  { value: 'info', label: 'Info', dot: 'bg-marque' },
  { value: 'urgent', label: 'Urgent', dot: 'bg-jaune' },
  { value: 'live', label: 'Direct', dot: 'bg-rouge' },
] as const

function levelLabel(level: string): string {
  return LEVELS.find((l) => l.value === level)?.label ?? level
}

function levelDot(level: string): string {
  return LEVELS.find((l) => l.value === level)?.dot ?? 'bg-muted-foreground'
}

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

// =====================================================================
// Dialog flash (création + édition)
// =====================================================================

interface FlashForm {
  text: string
  link: string
  level: string
  active: boolean
  startsAt: string
  endsAt: string
}

const EMPTY_FLASH: FlashForm = {
  text: '',
  link: '',
  level: 'info',
  active: true,
  startsAt: '',
  endsAt: '',
}

function FlashDialog({
  open,
  onOpenChange,
  flash,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  flash: FlashRow | null
  onSaved: () => void
}) {
  const isEdit = !!flash
  const { toast } = useToast()
  const [form, setForm] = useState<FlashForm>(EMPTY_FLASH)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof FlashForm>(key: K, value: FlashForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    if (!open) return
    setForm(
      flash
        ? {
            text: flash.text,
            link: flash.link ?? '',
            level: flash.level || 'info',
            active: flash.active,
            startsAt: isoToLocalInput(flash.startsAt),
            endsAt: isoToLocalInput(flash.endsAt),
          }
        : EMPTY_FLASH
    )
    setSaving(false)
  }, [open, flash])

  const save = async () => {
    if (!form.text.trim()) {
      toast({ title: 'Texte requis', variant: 'destructive' })
      return
    }
    setSaving(true)
    const startsAt = localInputToIso(form.startsAt)
    const endsAt = localInputToIso(form.endsAt)
    // Dates toujours envoyées (null = effacé) : permettre de retirer la fenêtre
    // de diffusion d'un flash existant, pas seulement de la définir.
    const payload = {
      text: form.text.trim(),
      link: form.link.trim() || null,
      level: form.level,
      active: form.active,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
    }
    try {
      if (flash) {
        await api.put(`/api/flash/${flash.id}`, payload)
        toast({ title: 'Flash enregistré' })
      } else {
        await api.post('/api/flash', payload)
        toast({ title: 'Flash créé' })
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
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le flash' : 'Nouveau flash'}</DialogTitle>
          <DialogDescription>
            Message court affiché dans le bandeau défilant du site public.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="flash-text">Texte *</Label>
              <span className="text-xs text-muted-foreground">{form.text.length}/200</span>
            </div>
            <Textarea
              id="flash-text"
              value={form.text}
              maxLength={200}
              rows={3}
              onChange={(e) => set('text', e.target.value)}
              placeholder="Information à afficher en continu…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flash-link">Lien (optionnel)</Label>
            <Input
              id="flash-link"
              value={form.link}
              onChange={(e) => set('link', e.target.value)}
              placeholder="/live"
            />
            <p className="text-xs text-muted-foreground">Chemin interne : /live, /tv, /fm, /rubrique/slug</p>
          </div>
          <div className="space-y-1.5">
            <Label>Niveau</Label>
            <Select value={form.level} onValueChange={(v) => set('level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', l.dot)} aria-hidden="true" />
                      {l.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0">
              <Label htmlFor="flash-active">Actif</Label>
              <p className="text-xs text-muted-foreground">Diffusé immédiatement si la fenêtre le permet.</p>
            </div>
            <Switch id="flash-active" checked={form.active} onCheckedChange={(v) => set('active', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="flash-start">Début (optionnel)</Label>
              <Input
                id="flash-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flash-end">Fin (optionnelle)</Label>
              <Input
                id="flash-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le flash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// Page
// =====================================================================

export default function AdminFlash() {
  const { toast } = useToast()
  const [rows, setRows] = useState<FlashRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FlashRow | null>(null)

  const load = useCallback(() => {
    api
      .get<{ flash: FlashRow[] }>('/api/flash')
      .then((d) => setRows(d.flash ?? []))
      .catch((err: unknown) => {
        setRows([])
        toast({ title: 'Chargement impossible', description: errMessage(err), variant: 'destructive' })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (f: FlashRow, active: boolean) => {
    try {
      await api.put(`/api/flash/${f.id}`, { active })
      toast({ title: active ? 'Flash activé' : 'Flash désactivé' })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
      load()
    }
  }

  const remove = async (f: FlashRow) => {
    try {
      await api.del(`/api/flash/${f.id}`)
      toast({ title: 'Flash supprimé' })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flash info"
        description="Bandeau d'actualités éphémères affiché en continu sur le site."
        actions={
          <Button
            className="min-h-[44px]"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouveau flash
          </Button>
        }
      />

      <Alert>
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Bandeau rouge du site public</AlertTitle>
        <AlertDescription>Les flash actifs défilent dans le bandeau rouge du site public.</AlertDescription>
      </Alert>

      <SectionCard
        title="Liste des flashs"
        description={`${rows?.length ?? 0} flash(s).`}
        contentClassName="p-0"
      >
        {rows === null ? (
          <div className="p-4">
            <ListSkeleton rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Zap}
              title="Aucun flash"
              description="Créez un premier message à diffuser dans le bandeau."
            />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-slim">
            <ul className="divide-y">
              {rows.map((f) => (
                <li key={f.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <span className={cn('h-2 w-2 rounded-full', levelDot(f.level))} aria-hidden="true" />
                    {levelLabel(f.level)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line text-sm font-medium">{f.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.startsAt && f.endsAt
                        ? `Du ${formatDateTime(f.startsAt)} au ${formatDateTime(f.endsAt)}`
                        : f.startsAt
                          ? `À partir du ${formatDateTime(f.startsAt)}`
                          : f.endsAt
                            ? `Jusqu'au ${formatDateTime(f.endsAt)}`
                            : 'Diffusion continue'}
                      {' · '}
                      {f.createdAt ? `créé ${timeAgo(f.createdAt)}` : ''}
                    </p>
                    {f.link ? (
                      <p className="mt-0.5 truncate font-mono text-xs text-marque">{f.link}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={f.active}
                      onCheckedChange={(v) => void toggleActive(f, v)}
                      aria-label={f.active ? 'Désactiver le flash' : 'Activer le flash'}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      title="Modifier"
                      aria-label="Modifier le flash"
                      onClick={() => {
                        setEditing(f)
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
                          aria-label="Supprimer le flash"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      }
                      title="Supprimer ce flash ?"
                      description="Le flash sera définitivement supprimé du bandeau."
                      onConfirm={() => remove(f)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <FlashDialog open={open} onOpenChange={setOpen} flash={editing} onSaved={load} />
    </div>
  )
}
