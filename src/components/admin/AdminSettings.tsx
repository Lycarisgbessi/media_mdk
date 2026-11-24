'use client'

// =====================================================================
// AdminSettings — réglages du site par sections
// (identité, coordonnées, réseaux sociaux, couleurs, modules FM/TV,
// général, SEO) — sauvegarde par carte
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { ContactInfo, HomepageBlockItem, SiteSettings, SocialLink } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ListSkeleton, PageHeader, SectionCard, errMessage } from './admin-ui'

interface SettingsResponse {
  settings: SiteSettings
  contactInfos: ContactInfo[]
  socialLinks: SocialLink[]
  homepageBlocks: HomepageBlockItem[]
}

type SettingsSection = 'identity' | 'colors' | 'modules' | 'general' | 'seo'

const TIMEZONE_OPTIONS = [
  'Atlantic/Reykjavik',
  'Europe/Paris',
  'Europe/London',
  'Europe/Dakar',
  'Europe/Abidjan',
  'Africa/Casablanca',
  'America/New_York',
  'Asia/Dubai',
]

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// ---------- Coordonnées (téléphone, e-mail, adresse, horaires) ----------

const CONTACT_TYPE_OPTIONS: { value: ContactInfo['type']; label: string }[] = [
  { value: 'phone', label: 'Téléphone' },
  { value: 'email', label: 'E-mail' },
  { value: 'address', label: 'Adresse' },
  { value: 'hours', label: 'Horaires' },
]

const CONTACT_TYPE_LABELS: Record<ContactInfo['type'], string> = Object.fromEntries(
  CONTACT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ContactInfo['type'], string>

const CONTACT_TYPE_ICONS: Record<ContactInfo['type'], typeof Phone> = {
  phone: Phone,
  email: Mail,
  address: MapPin,
  hours: Clock,
}

const CONTACT_VALUE_PLACEHOLDERS: Record<ContactInfo['type'], string> = {
  phone: '+225 01 02 03 04 05',
  email: 'contact@exemple.com',
  address: 'Rue, ville, pays',
  hours: 'Lun–Ven : 8h–18h',
}

const PHONE_RE = /^[+0-9 ().-]{6,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^https?:\/\/\S+$/

const PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
]

function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function contactErrorFor(c: ContactInfo): string {
  const value = c.value.trim()
  if (!c.label.trim()) return 'Indiquez un libellé.'
  if (!value) return 'Indiquez une valeur.'
  if (c.type === 'phone' && !PHONE_RE.test(value)) return 'Numéro invalide (ex. +225 01 02 03 04).'
  if (c.type === 'email' && !EMAIL_RE.test(value)) return 'Adresse e-mail invalide.'
  return ''
}

function socialErrorFor(s: SocialLink): string {
  const url = s.url.trim()
  if (!url) return 'Indiquez l’URL du profil.'
  if (!URL_RE.test(url)) return 'URL invalide : doit commencer par http:// ou https://.'
  return ''
}

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir
  if (j < 0 || j >= list.length) return list
  const copy = [...list]
  ;[copy[index], copy[j]] = [copy[j], copy[index]]
  return copy
}

function RowActions({
  index,
  total,
  label,
  busy,
  onMove,
  onRemove,
}: {
  index: number
  total: number
  label: string
  busy: boolean
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 text-muted-foreground"
        disabled={busy || index === 0}
        aria-label={`Monter « ${label} »`}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 text-muted-foreground"
        disabled={busy || index === total - 1}
        aria-label={`Descendre « ${label} »`}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 text-rouge hover:text-rouge"
        disabled={busy}
        aria-label={`Supprimer « ${label} »`}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  )
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(Number.isNaN(n) ? 0 : n)))
}

export default function AdminSettings() {
  const { toast } = useToast()
  const { setSiteData } = useAppStore()

  const [form, setForm] = useState<SiteSettings | null>(null)
  const [contacts, setContacts] = useState<ContactInfo[] | null>(null)
  const [socials, setSocials] = useState<SocialLink[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)

  const load = useCallback(() => {
    setFailed(false)
    api
      .get<SettingsResponse>('/api/settings')
      .then((d) => {
        setForm(d.settings)
        setContacts(d.contactInfos ?? [])
        setSocials(d.socialLinks ?? [])
      })
      .catch((err: unknown) => {
        setFailed(true)
        toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const timezoneOptions = useMemo(() => {
    const base = [...TIMEZONE_OPTIONS]
    if (form && form.timezone && !base.includes(form.timezone)) base.unshift(form.timezone)
    return base
  }, [form])

  const languageOptions = useMemo(() => {
    const base = [...LANGUAGE_OPTIONS]
    if (form && form.language && !base.some((l) => l.value === form.language)) {
      base.unshift({ value: form.language, label: form.language })
    }
    return base
  }, [form])

  const persist = async (section: SettingsSection, value: Record<string, unknown>) => {
    setSavingSection(section)
    try {
      await api.put('/api/settings', { section, value })
      // Recharge complet puis mise à jour du store global (site public)
      const fresh = await api.get<SettingsResponse>('/api/settings')
      setForm(fresh.settings)
      setSiteData(fresh.settings, fresh.contactInfos, fresh.socialLinks, fresh.homepageBlocks)
      toast({ title: 'Réglages enregistrés' })
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSavingSection(null)
    }
  }

  const saveButton = (section: SettingsSection, build: () => Record<string, unknown>) => (
    <Button
      size="sm"
      className="min-h-[44px]"
      disabled={savingSection !== null}
      onClick={() => void persist(section, build())}
    >
      {savingSection === section ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  )

  // ---- Coordonnées & réseaux : helpers d'édition locale ----

  const updateContact = (index: number, patch: Partial<ContactInfo>) =>
    setContacts((list) => {
      if (!list) return list
      const copy = [...list]
      copy[index] = { ...copy[index], ...patch }
      return copy
    })

  const updateSocial = (index: number, patch: Partial<SocialLink>) =>
    setSocials((list) => {
      if (!list) return list
      const copy = [...list]
      copy[index] = { ...copy[index], ...patch }
      return copy
    })

  const persistSiteData = async (
    key: 'contact_infos' | 'social_links',
    value: unknown,
    successTitle: string,
  ) => {
    setSavingSection(key)
    try {
      await api.put('/api/settings', { section: key, value })
      // Recharge complet puis mise à jour du store global (site public)
      const fresh = await api.get<SettingsResponse>('/api/settings')
      setForm(fresh.settings)
      setContacts(fresh.contactInfos ?? [])
      setSocials(fresh.socialLinks ?? [])
      setSiteData(fresh.settings, fresh.contactInfos, fresh.socialLinks, fresh.homepageBlocks)
      toast({ title: successTitle })
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSavingSection(null)
    }
  }

  const platformOptions = useMemo(() => {
    const base = [...PLATFORM_OPTIONS]
    for (const s of socials ?? []) {
      const raw = s.platform.trim()
      // Plateforme inconnue (ex. saisie historique) : on l'ajoute pour l'afficher
      if (raw && !base.some((o) => o.value === raw) && !base.some((o) => o.value === raw.toLowerCase())) {
        base.unshift({ value: raw, label: raw })
      }
    }
    return base
  }, [socials])

  if (!form) {
    return (
      <div className="space-y-4">
        <PageHeader title="Réglages du site" description="Identité, coordonnées, couleurs, modules et référencement." />
        {failed ? (
          <EmptyState
            icon={RefreshCw}
            title="Chargement impossible"
            description="Les réglages n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez."
            action={
              <Button onClick={load} className="min-h-[44px]">
                <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Réessayer
              </Button>
            }
          />
        ) : (
          <ListSkeleton rows={6} />
        )}
      </div>
    )
  }

  const desc = form.seoDescription

  const contactErrors = (contacts ?? []).map(contactErrorFor)
  const hasContactErrors = contactErrors.some((e) => e !== '')
  const socialErrors = (socials ?? []).map(socialErrorFor)
  const hasSocialErrors = socialErrors.some((e) => e !== '')
  const busyAny = savingSection !== null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réglages du site"
        description="Identité, coordonnées, réseaux sociaux, couleurs, modules et référencement — chaque carte possède son bouton d'enregistrement."
      />

      {/* ---- Identité ---- */}
      <SectionCard
        title="Identité"
        description="Nom, slogan et logo affichés sur le site public."
        actions={saveButton('identity', () => ({
          siteName: form.siteName,
          slogan: form.slogan,
          description: form.description,
          logoUrl: form.logoUrl,
          logoDarkUrl: form.logoDarkUrl,
        }))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-name">Nom du site</Label>
            <Input
              id="set-name"
              value={form.siteName}
              onChange={(e) => setForm((f) => (f ? { ...f, siteName: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-slogan">Slogan</Label>
            <Input
              id="set-slogan"
              value={form.slogan}
              onChange={(e) => setForm((f) => (f ? { ...f, slogan: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-desc">Description</Label>
            <Textarea
              id="set-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => (f ? { ...f, description: e.target.value } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-logo">Logo (URL, thème clair)</Label>
            <Input
              id="set-logo"
              value={form.logoUrl}
              onChange={(e) => setForm((f) => (f ? { ...f, logoUrl: e.target.value } : f))}
              placeholder="/images/logo.png"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-logo-dark">Logo (URL, thème sombre)</Label>
            <Input
              id="set-logo-dark"
              value={form.logoDarkUrl}
              onChange={(e) => setForm((f) => (f ? { ...f, logoDarkUrl: e.target.value } : f))}
              placeholder="/images/logo-dark.png"
            />
          </div>
        </div>
      </SectionCard>

      {/* ---- Coordonnées (téléphone, e-mail, adresse, horaires) ---- */}
      <SectionCard
        title="Coordonnées"
        description="Téléphones, e-mails, adresse et horaires affichés dans le pied de page et sur la page Contact. Les 4 premières apparaissent dans le pied de page."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={busyAny}
              onClick={() =>
                setContacts((l) => [
                  ...(l ?? []),
                  { id: newId(), type: 'phone', label: 'Téléphone', value: '' },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ajouter
            </Button>
            <Button
              size="sm"
              className="min-h-[44px]"
              disabled={busyAny || contacts === null || hasContactErrors}
              onClick={() => void persistSiteData('contact_infos', contacts, 'Coordonnées enregistrées')}
            >
              {savingSection === 'contact_infos' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        {contacts === null ? (
          <ListSkeleton rows={3} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Aucune coordonnée"
            description="Ajoutez un numéro de téléphone, un e-mail, une adresse ou des horaires : ils s'afficheront automatiquement sur le site public."
          />
        ) : (
          <div className="space-y-3">
            {hasContactErrors ? (
              <p className="text-xs font-medium text-rouge">
                Corrigez les champs signalés en rouge pour pouvoir enregistrer.
              </p>
            ) : null}
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1 scroll-slim">
              {contacts.map((c, i) => {
                const error = contactErrors[i]
                const Icon = CONTACT_TYPE_ICONS[c.type]
                return (
                  <div
                    key={c.id}
                    className={cn('rounded-lg border p-3', error ? 'border-rouge' : '')}
                  >
                    <div className="grid gap-2 sm:grid-cols-[9.5rem_11rem_1fr] sm:items-start">
                      <Select
                        value={c.type}
                        onValueChange={(v) => {
                          const type = v as ContactInfo['type']
                          const defaults = CONTACT_TYPE_OPTIONS.map((o) => o.label)
                          const currentLabel = c.label.trim()
                          const nextLabel =
                            !currentLabel || defaults.includes(currentLabel)
                              ? CONTACT_TYPE_LABELS[type]
                              : c.label
                          updateContact(i, { type, label: nextLabel })
                        }}
                      >
                        <SelectTrigger className="min-h-[44px] w-full" aria-label={`Type — coordonnée ${i + 1}`}>
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <SelectValue />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={c.label}
                        onChange={(e) => updateContact(i, { label: e.target.value })}
                        placeholder="Libellé (ex. Standard)"
                        aria-label={`Libellé — coordonnée ${i + 1}`}
                      />
                      <Input
                        value={c.value}
                        onChange={(e) => updateContact(i, { value: e.target.value })}
                        placeholder={CONTACT_VALUE_PLACEHOLDERS[c.type]}
                        inputMode={
                          c.type === 'phone' ? 'tel' : c.type === 'email' ? 'email' : 'text'
                        }
                        aria-label={`Valeur — coordonnée ${i + 1}`}
                        className={error ? 'border-rouge' : ''}
                      />
                    </div>
                    {error ? <p className="mt-1.5 text-xs text-rouge">{error}</p> : null}
                    <div className="mt-2">
                      <RowActions
                        index={i}
                        total={contacts.length}
                        label={c.label || CONTACT_TYPE_LABELS[c.type]}
                        busy={busyAny}
                        onMove={(dir) => setContacts((l) => (l ? moveItem(l, i, dir) : l))}
                        onRemove={() => setContacts((l) => (l ? l.filter((_, j) => j !== i) : l))}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ---- Réseaux sociaux ---- */}
      <SectionCard
        title="Réseaux sociaux"
        description="Profils affichés dans le pied de page et sur la page Contact. Masquez un réseau sans le supprimer grâce à l'interrupteur."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={busyAny}
              onClick={() =>
                setSocials((l) => [
                  ...(l ?? []),
                  { id: newId(), platform: 'facebook', url: '', active: true },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ajouter
            </Button>
            <Button
              size="sm"
              className="min-h-[44px]"
              disabled={busyAny || socials === null || hasSocialErrors}
              onClick={() => void persistSiteData('social_links', socials, 'Réseaux sociaux enregistrés')}
            >
              {savingSection === 'social_links' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        {socials === null ? (
          <ListSkeleton rows={3} />
        ) : socials.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="Aucun réseau social"
            description="Ajoutez les profils du média (Facebook, X, Instagram, YouTube…) : ils s'afficheront automatiquement sur le site public."
          />
        ) : (
          <div className="space-y-3">
            {hasSocialErrors ? (
              <p className="text-xs font-medium text-rouge">
                Corrigez les champs signalés en rouge pour pouvoir enregistrer.
              </p>
            ) : null}
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1 scroll-slim">
              {socials.map((s, i) => {
                const error = socialErrors[i]
                return (
                  <div
                    key={s.id}
                    className={cn('rounded-lg border p-3', error ? 'border-rouge' : '')}
                  >
                    <div className="grid gap-2 sm:grid-cols-[11rem_1fr_auto] sm:items-center">
                      <Select
                        value={
                          platformOptions.find(
                            (o) => o.value === s.platform || o.value === s.platform.toLowerCase().trim(),
                          )?.value ?? s.platform
                        }
                        onValueChange={(v) => updateSocial(i, { platform: v })}
                      >
                        <SelectTrigger className="min-h-[44px] w-full" aria-label={`Plateforme — réseau ${i + 1}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {platformOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={s.url}
                        onChange={(e) => updateSocial(i, { url: e.target.value })}
                        placeholder="https://facebook.com/…"
                        inputMode="url"
                        aria-label={`URL — réseau ${i + 1}`}
                        className={error ? 'border-rouge' : ''}
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`soc-active-${s.id}`}
                          checked={s.active}
                          onCheckedChange={(v) => updateSocial(i, { active: v })}
                        />
                        <Label htmlFor={`soc-active-${s.id}`} className="text-xs font-normal text-muted-foreground">
                          Visible
                        </Label>
                      </div>
                    </div>
                    {error ? <p className="mt-1.5 text-xs text-rouge">{error}</p> : null}
                    <div className="mt-2">
                      <RowActions
                        index={i}
                        total={socials.length}
                        label={s.platform || 'réseau'}
                        busy={busyAny}
                        onMove={(dir) => setSocials((l) => (l ? moveItem(l, i, dir) : l))}
                        onRemove={() => setSocials((l) => (l ? l.filter((_, j) => j !== i) : l))}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ---- Couleurs ---- */}
      <SectionCard
        title="Couleurs"
        description="Charte graphique : vert (primaire), jaune (accent), rouge (action)."
        actions={saveButton('colors', () => ({
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          actionColor: form.actionColor,
        }))}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ColorField
            id="set-primary"
            label="Primaire"
            value={form.primaryColor}
            onChange={(v) => setForm((f) => (f ? { ...f, primaryColor: v } : f))}
          />
          <ColorField
            id="set-accent"
            label="Accent"
            value={form.accentColor}
            onChange={(v) => setForm((f) => (f ? { ...f, accentColor: v } : f))}
          />
          <ColorField
            id="set-action"
            label="Action"
            value={form.actionColor}
            onChange={(v) => setForm((f) => (f ? { ...f, actionColor: v } : f))}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aperçu :</span>
          <span className="flex items-center gap-2 rounded-lg border p-2 pr-3">
            <span className="h-8 w-8 rounded-md border" style={{ background: form.primaryColor }} aria-hidden="true" />
            <span className="text-xs">Primaire</span>
          </span>
          <span className="flex items-center gap-2 rounded-lg border p-2 pr-3">
            <span className="h-8 w-8 rounded-md border" style={{ background: form.accentColor }} aria-hidden="true" />
            <span className="text-xs">Accent</span>
          </span>
          <span className="flex items-center gap-2 rounded-lg border p-2 pr-3">
            <span className="h-8 w-8 rounded-md border" style={{ background: form.actionColor }} aria-hidden="true" />
            <span className="text-xs">Action</span>
          </span>
          <div
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2 text-white shadow-sm"
            style={{ background: form.primaryColor }}
          >
            <span className="text-sm font-bold">Titre</span>
            <span className="rounded px-2 py-1 text-xs font-bold text-black" style={{ background: form.accentColor }}>
              Bouton
            </span>
            <span className="rounded px-2 py-1 text-xs font-bold text-white" style={{ background: form.actionColor }}>
              Alerte
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ---- Modules ---- */}
      <SectionCard
        title="Modules"
        description="Activer ou masquer les modules FM (audio) et TV (vidéo)."
        actions={saveButton('modules', () => ({
          moduleFmActive: form.moduleFmActive,
          moduleTvActive: form.moduleTvActive,
        }))}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="set-mod-fm" className="font-normal">Module FM (audio)</Label>
              <p className="text-xs text-muted-foreground">Podcasts, émissions, grille des programmes et direct audio.</p>
            </div>
            <Switch
              id="set-mod-fm"
              checked={form.moduleFmActive}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, moduleFmActive: v } : f))}
            />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="set-mod-tv" className="font-normal">Module TV (vidéo)</Label>
              <p className="text-xs text-muted-foreground">Vidéos, reportages et flux YouTube en direct.</p>
            </div>
            <Switch
              id="set-mod-tv"
              checked={form.moduleTvActive}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, moduleTvActive: v } : f))}
            />
          </div>
          <Alert className="border-jaune bg-jaune-clair text-yellow-900 dark:bg-jaune/10 dark:text-jaune">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Désactivation immédiate</AlertTitle>
            <AlertDescription>
              La désactivation masque immédiatement le module du site public (menu, page d&apos;accueil) sans supprimer
              le contenu. Aucun redéploiement nécessaire.
            </AlertDescription>
          </Alert>
        </div>
      </SectionCard>

      {/* ---- Général ---- */}
      <SectionCard
        title="Général"
        description="Localisation et fonctionnalités communautaires."
        actions={saveButton('general', () => ({
          timezone: form.timezone,
          language: form.language,
          commentsEnabled: form.commentsEnabled,
          maintenanceMode: form.maintenanceMode,
        }))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Fuseau horaire</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => setForm((f) => (f ? { ...f, timezone: v } : f))}
            >
              <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Langue du site</Label>
            <Select
              value={form.language}
              onValueChange={(v) => setForm((f) => (f ? { ...f, language: v } : f))}
            >
              <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {languageOptions.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="set-comments" className="font-normal">Commentaires activés</Label>
            <Switch
              id="set-comments"
              checked={form.commentsEnabled}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, commentsEnabled: v } : f))}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <div className="space-y-0.5">
              <Label htmlFor="set-maintenance" className="font-normal">Mode maintenance</Label>
              <p className="text-xs text-muted-foreground">Affiche un bandeau de maintenance sur le site public.</p>
            </div>
            <Switch
              id="set-maintenance"
              checked={form.maintenanceMode}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, maintenanceMode: v } : f))}
            />
          </div>
        </div>
      </SectionCard>

      {/* ---- SEO ---- */}
      <SectionCard
        title="SEO"
        description="Référencement naturel, assistant éditorial et ads.txt."
        actions={saveButton('seo', () => ({
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          seoKeywords: form.seoKeywords,
          seoAssistantEnabled: form.seoAssistantEnabled,
          minSeoScore: clampScore(form.minSeoScore),
          adsTxt: form.adsTxt,
        }))}
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-seo-title">Titre SEO</Label>
            <Input
              id="set-seo-title"
              value={form.seoTitle}
              onChange={(e) => setForm((f) => (f ? { ...f, seoTitle: e.target.value } : f))}
              placeholder="Utilisé si vide : nom du site + slogan"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-seo-desc">Méta-description</Label>
            <Textarea
              id="set-seo-desc"
              rows={3}
              value={form.seoDescription}
              onChange={(e) => setForm((f) => (f ? { ...f, seoDescription: e.target.value } : f))}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Longueur recommandée : 120 à 160 caractères</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  desc.length >= 120 && desc.length <= 160
                    ? 'text-marque'
                    : desc.length > 160
                      ? 'text-rouge'
                      : 'text-muted-foreground'
                )}
              >
                {desc.length} caractères
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-seo-kw">Mots-clés</Label>
            <Input
              id="set-seo-kw"
              value={form.seoKeywords}
              onChange={(e) => setForm((f) => (f ? { ...f, seoKeywords: e.target.value } : f))}
              placeholder="actualités, politique, économie, sport…"
            />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="set-seo-assist" className="font-normal">Assistant SEO</Label>
              <p className="text-xs text-muted-foreground">Conseils et score SEO lors de la rédaction des contenus.</p>
            </div>
            <Switch
              id="set-seo-assist"
              checked={form.seoAssistantEnabled}
              onCheckedChange={(v) => setForm((f) => (f ? { ...f, seoAssistantEnabled: v } : f))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-seo-score">Score SEO minimum (0 à 100)</Label>
            <Input
              id="set-seo-score"
              type="number"
              min={0}
              max={100}
              step={1}
              value={String(form.minSeoScore)}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                setForm((f) => (f ? { ...f, minSeoScore: Number.isNaN(n) ? 0 : n } : f))
              }}
              className="max-w-32"
            />
            <p className="text-xs text-muted-foreground">0 = conseils non bloquants ; au-delà, la publication exige un score SEO minimal.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-adstxt">Contenu ads.txt</Label>
            <Textarea
              id="set-adstxt"
              rows={4}
              className="font-mono text-xs"
              value={form.adsTxt}
              onChange={(e) => setForm((f) => (f ? { ...f, adsTxt: e.target.value } : f))}
              placeholder="google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
            />
            <p className="text-xs text-muted-foreground">Publié sous /ads.txt</p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
