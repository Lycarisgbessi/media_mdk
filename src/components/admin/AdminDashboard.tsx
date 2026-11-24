'use client'

// =====================================================================
// AdminDashboard — vue d'ensemble : KPIs, audience, notifications,
// raccourcis de création et calendrier éditorial
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarClock,
  Eye,
  FilePenLine,
  Inbox,
  Info,
  LayoutList,
  MessageSquare,
  Mic,
  Newspaper,
  Radio,
  TriangleAlert,
  Tv,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { ArticlePayload, DashboardStats, LiveStreamPayload, VideoPayload } from '@/lib/types'
import { formatDate } from '@/lib/helpers'
import { PageHeader, StatCard, SectionCard, ListSkeleton, ChartSkeleton, errMessage } from './admin-ui'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface CalEntry {
  id: string
  title: string
  day: string // YYYY-MM-DD
  time: string // HH:mm
  type: 'article' | 'video' | 'direct'
}

const TYPE_BADGE: Record<CalEntry['type'], { label: string; cls: string; icon: LucideIcon }> = {
  article: { label: 'Article', cls: 'bg-marque-clair text-marque dark:bg-marque/15', icon: Newspaper },
  video: { label: 'Vidéo', cls: 'bg-jaune-clair text-yellow-900 dark:text-jaune', icon: Tv },
  direct: { label: 'Direct', cls: 'bg-rouge-clair text-rouge', icon: Radio },
}

function dayLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

function fullDayLabel(day: string): string {
  try {
    return new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return day
  }
}

function timeOf(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export default function AdminDashboard() {
  const { navigate, settings } = useAppStore()
  const { toast } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [entries, setEntries] = useState<CalEntry[] | null>(null)

  const loadStats = useCallback(() => {
    api
      .get<{ stats?: DashboardStats } & DashboardStats>('/api/stats')
      .then((data) => {
        setStats(data.stats ?? data)
        setStatsError(null)
      })
      .catch((err: unknown) => setStatsError(errMessage(err)))
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // ---- Calendrier éditorial : planifications à venir ----
  useEffect(() => {
    let cancelled = false
    const now = Date.now()
    const collect = async () => {
      const out: CalEntry[] = []
      const [articlesRes, videosRes, livesRes] = await Promise.allSettled([
        api.get<{ articles: ArticlePayload[] }>('/api/articles?status=scheduled&limit=20'),
        api.get<{ videos: VideoPayload[] }>('/api/videos?status=scheduled&limit=20'),
        api.get<{ lives: LiveStreamPayload[] }>('/api/lives'),
      ])
      if (cancelled) return
      if (articlesRes.status === 'fulfilled') {
        for (const a of articlesRes.value.articles) {
          if (!a.scheduledAt || new Date(a.scheduledAt).getTime() < now) continue
          const d = new Date(a.scheduledAt)
          out.push({ id: `a-${a.id}`, title: a.title, day: d.toISOString().slice(0, 10), time: timeOf(a.scheduledAt), type: 'article' })
        }
      }
      if (videosRes.status === 'fulfilled') {
        for (const v of videosRes.value.videos) {
          if (!v.scheduledAt || new Date(v.scheduledAt).getTime() < now) continue
          const d = new Date(v.scheduledAt)
          out.push({ id: `v-${v.id}`, title: v.title, day: d.toISOString().slice(0, 10), time: timeOf(v.scheduledAt), type: 'video' })
        }
      }
      if (livesRes.status === 'fulfilled') {
        for (const l of livesRes.value.lives) {
          if (l.status !== 'scheduled' || !l.scheduledStart || new Date(l.scheduledStart).getTime() < now) continue
          const d = new Date(l.scheduledStart)
          out.push({ id: `l-${l.id}`, title: l.title, day: d.toISOString().slice(0, 10), time: timeOf(l.scheduledStart), type: 'direct' })
        }
      }
      out.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time))
      setEntries(out)
    }
    void collect()
    return () => {
      cancelled = true
    }
  }, [])

  const groupedCalendar = useMemo(() => {
    if (!entries) return null
    const map = new Map<string, CalEntry[]>()
    for (const e of entries) {
      const list = map.get(e.day) ?? []
      list.push(e)
      map.set(e.day, list)
    }
    return Array.from(map.entries())
  }, [entries])

  const notifications = useMemo(() => {
    if (!stats) return []
    const items: { icon: LucideIcon; text: string; cls: string; go?: () => void }[] = []
    if (stats.pendingArticles > 0) {
      items.push({
        icon: FilePenLine,
        text: `${stats.pendingArticles} contenu(s) en relecture attendent une validation`,
        cls: 'text-yellow-600 dark:text-jaune',
        go: () => navigate({ name: 'admin', section: 'articles' }),
      })
    }
    if (stats.pendingComments > 0) {
      items.push({
        icon: MessageSquare,
        text: `${stats.pendingComments} commentaire(s) en attente de modération`,
        cls: 'text-yellow-600 dark:text-jaune',
        go: () => navigate({ name: 'admin', section: 'comments' }),
      })
    }
    if (stats.unreadMessages > 0) {
      items.push({
        icon: Inbox,
        text: `${stats.unreadMessages} message(s) de contact non lu(s)`,
        cls: 'text-rouge',
        go: () => navigate({ name: 'admin', section: 'contact' }),
      })
    }
    if (stats.activeLives > 0) {
      items.push({
        icon: Radio,
        text: `${stats.activeLives} direct actuellement à l'antenne`,
        cls: 'text-rouge',
        go: () => navigate({ name: 'admin', section: 'tv' }),
      })
    }
    // Lien média à vérifier — information permanente (§16.2)
    items.push({
      icon: TriangleAlert,
      text: "Liens audio et vidéo à vérifier : assurez-vous que les fichiers Drive et les vidéos YouTube restent lisibles depuis la page publique",
      cls: 'text-muted-foreground',
    })
    return items
  }, [stats, navigate])

  const shortcuts: { label: string; icon: LucideIcon; go: () => void }[] = [
    { label: 'Nouvel article', icon: Newspaper, go: () => navigate({ name: 'admin', section: 'articles', id: 'new' }) },
    { label: 'Nouvel épisode FM', icon: Mic, go: () => navigate({ name: 'admin', section: 'fm', id: 'new-episode' }) },
    { label: 'Nouveau reportage TV', icon: Tv, go: () => navigate({ name: 'admin', section: 'tv', id: 'new-video' }) },
    { label: 'Nouveau flash', icon: Zap, go: () => navigate({ name: 'admin', section: 'flash', id: 'new' }) },
  ]

  const moduleFm = settings?.moduleFmActive ?? true
  const moduleTv = settings?.moduleTvActive ?? true

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de l'activité de la rédaction — contenus, audience et modération."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadStats()
              toast({ title: 'Statistiques actualisées' })
            }}
          >
            <LayoutList className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Actualiser
          </Button>
        }
      />

      {/* ---- KPIs ---- */}
      {statsError ? (
        <SectionCard>
          <p className="text-sm text-rouge">{statsError}</p>
        </SectionCard>
      ) : !stats ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Eye} label="Vues du jour" value={stats.todayViews} hint="Tous contenus confondus" />
          <StatCard icon={Newspaper} label="Articles publiés" value={stats.publishedArticles} hint={`${stats.totalArticles} au total`} />
          <StatCard icon={Mic} label="Épisodes publiés" value={stats.totalAudio} hint="Module FM" />
          <StatCard icon={Tv} label="Vidéos" value={stats.totalVideos} hint="Reportages et extraits" />
          <StatCard icon={MessageSquare} label="Commentaires en attente" value={stats.pendingComments} accent="jaune" hint="À modérer" />
          <StatCard icon={Inbox} label="Messages non lus" value={stats.unreadMessages} accent="rouge" hint="Messagerie de contact" />
          <StatCard icon={Radio} label="Directs actifs" value={stats.activeLives} hint="En cours à l'antenne" />
        </div>
      )}

      {/* ---- Graphiques ---- */}
      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard
          title="Audience des 14 derniers jours"
          description="Vues cumulées des articles, épisodes audio et vidéos par jour."
          className="lg:col-span-3"
        >
          {!stats ? (
            <ChartSkeleton />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.viewsByDay} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMarque" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--marque)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--marque)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <Tooltip
                    formatter={(value) => [`${value} vue(s)`, 'Vues']}
                    labelFormatter={(label) => formatDate(String(label), { weekday: 'long', day: 'numeric', month: 'long' })}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="count" name="Vues" stroke="var(--marque)" strokeWidth={2} fill="url(#gradMarque)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Contenus par rubrique" description="Articles publiés, top 8 des rubriques." className="lg:col-span-2">
          {!stats ? (
            <ChartSkeleton />
          ) : stats.byCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun article publié pour l&apos;instant.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byCategory} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: 'var(--foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => [`${value} article(s)`, 'Publiés']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13 }}
                  />
                  <Bar dataKey="count" name="Articles" fill="var(--marque)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ---- Raccourcis ---- */}
      <SectionCard title="Création rapide" description="Accédez directement aux formulaires de publication.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.go}
              className="flex min-h-[56px] items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-marque hover:bg-marque-clair dark:hover:bg-marque/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marque-clair text-marque dark:bg-marque/15">
                <s.icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Notifications ---- */}
        <SectionCard title="Notifications" description="Ce qui attend une action de la rédaction.">
          <ul className="space-y-1">
            {notifications.map((n, i) => {
              const Wrapper = n.go ? 'button' : 'div'
              return (
                <li key={i}>
                  <Wrapper
                    {...(n.go ? { type: 'button', onClick: n.go } : {})}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <n.icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.cls}`} aria-hidden="true" />
                    <span className="text-foreground/90">{n.text}</span>
                  </Wrapper>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Astuce : les liens média (Drive/YouTube) sont hébergés par des services tiers — un contrôle hebdomadaire garantit
            la disponibilité des épisodes FM et reportages TV côté public.
          </p>
        </SectionCard>

        {/* ---- Calendrier éditorial ---- */}
        <SectionCard
          title="Calendrier éditorial"
          description="Publications planifiées à venir : articles, vidéos et directs."
        >
          {!groupedCalendar ? (
            <ListSkeleton rows={3} />
          ) : groupedCalendar.length === 0 ? (
            <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <CalendarClock className="h-6 w-6" aria-hidden="true" />
              Aucune publication planifiée à venir.
            </p>
          ) : (
            <div className="scroll-slim max-h-96 space-y-4 overflow-y-auto pr-1">
              {groupedCalendar.map(([day, dayEntries]) => (
                <div key={day}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fullDayLabel(day)}</p>
                  <ul className="space-y-1.5">
                    {dayEntries.map((e) => {
                      const badge = TYPE_BADGE[e.type]
                      return (
                        <li
                          key={e.id}
                          className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                        >
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                            <badge.icon className="h-3 w-3" aria-hidden="true" />
                            {badge.label}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{e.time}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Modules actifs : FM {moduleFm ? '✓' : '— (désactivé)'} · TV {moduleTv ? '✓' : '— (désactivé)'} — gérés dans Réglages.
          </p>
        </SectionCard>
      </div>
    </div>
  )
}
