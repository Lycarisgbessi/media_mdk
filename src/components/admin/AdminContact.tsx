'use client'

// =====================================================================
// AdminContact — messagerie du formulaire de contact
// Filtres par statut (nouveau/lu/traité/archivé), détail, note interne,
// marquage automatique « lu » à l'ouverture d'un message non lu
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CheckCheck,
  Inbox,
  Mail,
  Paperclip,
  Phone,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import type { ContactMessagePayload } from '@/lib/types'
import { formatDateTime, timeAgo } from '@/lib/helpers'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ConfirmAction,
  EmptyState,
  ListSkeleton,
  PageHeader,
  StatCard,
  StatusBadge,
  errMessage,
} from './admin-ui'

// ---------- Filtres ----------

type ContactFilter = 'all' | 'new' | 'read' | 'answered' | 'archived'

const FILTERS: { value: ContactFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'new', label: 'Nouveau' },
  { value: 'read', label: 'Lu' },
  { value: 'answered', label: 'Traité' },
  { value: 'archived', label: 'Archivé' },
]

const EMPTY_TITLES: Record<ContactFilter, string> = {
  all: 'Aucun message',
  new: 'Aucun nouveau message',
  read: 'Aucun message lu',
  answered: 'Aucun message traité',
  archived: 'Aucun message archivé',
}

// =====================================================================
// Vue principale Messagerie
// =====================================================================

export default function AdminContact() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ContactMessagePayload[] | null>(null)
  const [filter, setFilter] = useState<ContactFilter>('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<ContactMessagePayload | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api
      .get<{ messages: ContactMessagePayload[] }>('/api/contact-messages')
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const list = messages ?? []
    if (filter === 'all') return list
    return list.filter((m) => m.status === filter)
  }, [messages, filter])

  const unread = useMemo(() => (messages ?? []).filter((m) => m.status === 'new').length, [messages])

  // Ouverture d'un message : marquage silencieux « lu » si nécessaire
  const openMessage = (m: ContactMessagePayload) => {
    setSelected({ ...m })
    setNoteDraft(m.note ?? '')
    setDetailOpen(true)
    if (m.status === 'new') {
      api
        .patch(`/api/contact-messages/${m.id}`, { status: 'read' })
        .then(() => {
          setSelected((prev) => (prev && prev.id === m.id ? { ...prev, status: 'read' } : prev))
          load()
        })
        .catch(() => {
          // marquage silencieux : l'équipe pourra refaire l'action manuellement
        })
    }
  }

  const setStatus = async (m: ContactMessagePayload, status: string, label: string) => {
    setBusy(true)
    try {
      await api.patch(`/api/contact-messages/${m.id}`, { status })
      toast({ title: label, description: m.subject })
      setSelected((prev) => (prev && prev.id === m.id ? { ...prev, status } : prev))
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const saveNote = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await api.patch(`/api/contact-messages/${selected.id}`, { note: noteDraft.trim() || null })
      toast({ title: 'Note enregistrée', description: selected.subject })
      setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, note: noteDraft.trim() || null } : prev))
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: ContactMessagePayload) => {
    try {
      await api.del(`/api/contact-messages/${m.id}`)
      toast({ title: 'Message supprimé', description: m.subject })
      setDetailOpen(false)
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      throw err
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie"
        description="Messages reçus via le formulaire de contact : suivi, notes internes et traitement."
      />

      {messages ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={Inbox} label="Non lus" value={unread} accent="rouge" hint="Statut nouveau" />
          <StatCard icon={Mail} label="Total" value={messages.length} accent="marque" />
        </div>
      ) : (
        <ListSkeleton rows={2} className="sm:grid sm:grid-cols-2" />
      )}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as ContactFilter)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!messages ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={EMPTY_TITLES[filter]}
          description="Les messages envoyés depuis le formulaire de contact du site apparaîtront ici."
        />
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto scroll-slim">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => openMessage(m)}
              className="flex min-h-[44px] w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="flex min-w-0 flex-1 items-start gap-2">
                {m.status === 'new' ? (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rouge" aria-hidden="true" />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.subject}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.name} · {m.email}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{timeAgo(m.createdAt)}</span>
                <StatusBadge status={m.status} />
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
              <span className="min-w-0 truncate">{selected?.subject}</span>
              {selected ? <StatusBadge status={selected.status} /> : null}
            </DialogTitle>
            <DialogDescription>
              {selected ? `Reçu le ${formatDateTime(selected.createdAt)} (${timeAgo(selected.createdAt)})` : ''}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-1 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <p className="flex items-center gap-2 font-semibold sm:col-span-2">
                  <span className="truncate">{selected.name}</span>
                </p>
                <a
                  href={`mailto:${selected.email}`}
                  className="flex min-h-[44px] items-center gap-2 break-all text-sm text-marque underline-offset-2 hover:underline sm:min-h-0"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {selected.email}
                </a>
                {selected.phone ? (
                  <a
                    href={`tel:${selected.phone}`}
                    className="flex min-h-[44px] items-center gap-2 text-sm text-marque underline-offset-2 hover:underline sm:min-h-0"
                  >
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {selected.phone}
                  </a>
                ) : null}
                {selected.attachmentUrl ? (
                  <a
                    href={selected.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] items-center gap-2 break-all text-sm text-marque underline-offset-2 hover:underline sm:col-span-2 sm:min-h-0"
                  >
                    <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Pièce jointe
                  </a>
                ) : null}
              </div>

              <div className="whitespace-pre-line rounded-lg border p-4 text-sm leading-relaxed">
                {selected.message}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-note">Note interne</Label>
                <Textarea
                  id="contact-note"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Notes réservées à l'équipe (contexte, relances…)"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={busy}
                  onClick={() => void saveNote()}
                >
                  <StickyNote className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Enregistrer la note
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 border-t pt-3 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={busy || !selected || selected.status === 'read'}
                onClick={() => selected && void setStatus(selected, 'read', 'Message marqué comme lu')}
              >
                <Mail className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Marquer comme lu
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={busy || !selected || selected.status === 'answered'}
                onClick={() => selected && void setStatus(selected, 'answered', 'Message marqué comme traité')}
              >
                <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Marquer traité
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={busy || !selected || selected.status === 'archived'}
                onClick={() => selected && void setStatus(selected, 'archived', 'Message archivé')}
              >
                <Archive className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Archiver
              </Button>
            </div>
            {selected ? (
              <ConfirmAction
                title="Supprimer ce message ?"
                description={`« ${selected.subject} » sera définitivement supprimé.`}
                confirmLabel="Supprimer"
                onConfirm={async () => {
                  await remove(selected)
                }}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] text-rouge hover:text-rouge"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Supprimer
                  </Button>
                }
              />
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
