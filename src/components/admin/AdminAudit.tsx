'use client'

// =====================================================================
// AdminAudit — journal d'audit : traçabilité des actions de la rédaction
// (filtre client, rafraîchissement, détail des données JSON)
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ScrollText, Search } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { AuditLogPayload } from '@/lib/types'
import { formatDateTime } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ListSkeleton, PageHeader, errMessage } from './admin-ui'

interface AuditRow extends AuditLogPayload {
  user?: { id: string; firstName: string; lastName: string } | null
}

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 14)}…` : value
}

function prettyData(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export default function AdminAudit() {
  const { toast } = useToast()

  const [logs, setLogs] = useState<AuditRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const d = await api.get<{ logs: AuditRow[] }>('/api/audit?limit=200')
      setLogs(d.logs ?? [])
    } catch (err: unknown) {
      setLogs([])
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const displayName = (l: AuditRow): string =>
    l.user ? `${l.user.firstName} ${l.user.lastName}` : l.userName || 'Système'

  const filtered = useMemo(() => {
    if (!logs) return []
    const q = filter.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((l) =>
      [l.action, l.entity, l.entityId ?? '', displayName(l), l.data ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [logs, filter])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal d'audit"
        description="Traçabilité de toutes les actions de la rédaction."
        actions={
          <Button variant="outline" className="min-h-[44px]" disabled={refreshing} onClick={() => void load()}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
            Actualiser
          </Button>
        }
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer par action, entité, utilisateur…"
          className="pl-9"
          aria-label="Filtrer le journal d'audit"
        />
      </div>

      {!logs ? (
        <ListSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filter ? 'Aucun résultat' : 'Journal vide'}
          description={
            filter
              ? 'Aucune entrée ne correspond à votre filtre.'
              : "Les actions de la rédaction (créations, modifications, suppressions) apparaîtront ici."
          }
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} entrée{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''} sur {logs.length}.
          </p>
          <div className="max-h-[600px] overflow-auto scroll-slim rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entité</TableHead>
                  <TableHead className="min-w-44">Données</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const pretty = prettyData(l.data)
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{displayName(l)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap font-mono text-[10px]">
                          {l.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm">{l.entity}</span>
                          {l.entityId ? (
                            <span className="truncate font-mono text-[11px] text-muted-foreground" title={l.entityId}>
                              {shortId(l.entityId)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pretty ? (
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-marque">Données</summary>
                            <pre className="mt-1 max-h-40 overflow-auto scroll-slim rounded bg-muted p-2 text-xs">
                              {pretty}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
