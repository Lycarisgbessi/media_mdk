'use client'

// =====================================================================
// AdminComments — modération des commentaires (articles, épisodes, vidéos)
// Filtres par statut, approbation/rejet/spam, suppression, navigation SPA
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  MessageSquare,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { CommentPayload, View } from '@/lib/types'
import { timeAgo } from '@/lib/helpers'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

type CommentRow = CommentPayload & { isReply: boolean }

/** Aplatit les éventuelles réponses imbriquées (l'API staff renvoie une liste plate avec parentId). */
function flattenComments(list: CommentPayload[]): CommentRow[] {
  const out: CommentRow[] = []
  const walk = (rows: CommentPayload[], reply: boolean) => {
    for (const c of rows) {
      out.push({ ...c, isReply: reply || !!c.parentId })
      if (c.replies?.length) walk(c.replies, true)
    }
  }
  walk(list, false)
  return out
}

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'spam', label: 'Spam' },
] as const

type ModerationStatus = 'approved' | 'rejected' | 'spam'

const MODERATION_TOASTS: Record<ModerationStatus, string> = {
  approved: 'Commentaire approuvé',
  rejected: 'Commentaire rejeté',
  spam: 'Commentaire marqué comme spam',
}

/** Cible de navigation SPA selon le contenu lié au commentaire. */
function relatedTarget(c: CommentPayload): { view: View; title: string } | null {
  if (c.article) return { view: { name: 'article', slug: c.article.slug }, title: c.article.title }
  if (c.audio) return { view: { name: 'episode', slug: c.audio.slug }, title: c.audio.title }
  if (c.video) return { view: { name: 'video', id: c.video.id }, title: c.video.title }
  return null
}

export default function AdminComments() {
  const { toast } = useToast()
  const navigate = useAppStore((s) => s.navigate)
  const [rows, setRows] = useState<CommentRow[] | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(() => {
    api
      .get<{ comments: CommentPayload[] }>('/api/comments?all=1')
      .then((d) => setRows(flattenComments(d.comments ?? [])))
      .catch((err: unknown) => {
        setRows([])
        toast({ title: 'Chargement impossible', description: errMessage(err), variant: 'destructive' })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, pending: 0, approved: 0, rejected: 0, spam: 0 }
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1
    c.all = rows?.length ?? 0
    return c
  }, [rows])

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => filter === 'all' || r.status === filter),
    [rows, filter]
  )

  const moderate = async (c: CommentRow, status: ModerationStatus) => {
    try {
      await api.patch(`/api/comments/${c.id}`, { status })
      toast({ title: MODERATION_TOASTS[status], description: `Commentaire de ${c.authorName}` })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
    }
  }

  const remove = async (c: CommentRow) => {
    try {
      await api.del(`/api/comments/${c.id}`)
      toast({ title: 'Commentaire supprimé', description: `Commentaire de ${c.authorName}` })
      load()
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: errMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commentaires"
        description="Modération des réactions du public sur les articles, épisodes et vidéos."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={MessageSquare} label="En attente" value={counts.pending} accent="jaune" hint="À modérer" />
        <StatCard icon={CheckCircle2} label="Approuvés" value={counts.approved} accent="marque" hint="Visibles sur le site" />
        <StatCard icon={XCircle} label="Rejetés" value={counts.rejected} accent="rouge" hint="Masqués du site" />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="h-auto flex-wrap justify-start">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="min-h-[44px]">
              {f.label}
              <Badge variant="secondary" className="ml-1.5 tabular-nums">
                {counts[f.value] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard
        title="Liste de modération"
        description={`${filtered.length} commentaire(s) affiché(s).`}
        contentClassName="p-0"
      >
        {rows === null ? (
          <div className="p-4">
            <ListSkeleton rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Inbox}
              title="Aucun commentaire"
              description={
                filter === 'all'
                  ? 'Aucun commentaire pour le moment.'
                  : `Aucun commentaire dans « ${FILTERS.find((f) => f.value === filter)?.label ?? filter} ».`
              }
            />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-slim">
            <ul className="divide-y">
              {filtered.map((c) => {
                const related = relatedTarget(c)
                return (
                  <li key={c.id} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{c.authorName}</p>
                      {c.isReply ? (
                        <Badge variant="outline" className="text-xs">Réponse</Badge>
                      ) : null}
                      {(c.reports ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          Signalé ×{c.reports}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      <span className="ml-auto">
                        <StatusBadge status={c.status} />
                      </span>
                    </div>
                    <p className="max-h-32 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground scroll-slim">
                      {c.content}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {related ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] max-w-full"
                          onClick={() => navigate(related.view)}
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">Voir : {related.title}</span>
                        </Button>
                      ) : null}
                      <span className="grow" />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-marque hover:text-marque"
                          title="Approuver"
                          aria-label="Approuver"
                          disabled={c.status === 'approved'}
                          onClick={() => void moderate(c, 'approved')}
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-rouge hover:text-rouge"
                          title="Rejeter"
                          aria-label="Rejeter"
                          disabled={c.status === 'rejected'}
                          onClick={() => void moderate(c, 'rejected')}
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-yellow-600 dark:text-jaune"
                          title="Signaler comme spam"
                          aria-label="Signaler comme spam"
                          disabled={c.status === 'spam'}
                          onClick={() => void moderate(c, 'spam')}
                        >
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <ConfirmAction
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-rouge hover:text-rouge"
                              title="Supprimer"
                              aria-label="Supprimer le commentaire"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          }
                          title="Supprimer ce commentaire ?"
                          description="Le commentaire et ses éventuelles réponses seront définitivement supprimés."
                          onConfirm={() => remove(c)}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
