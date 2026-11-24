'use client'

// =====================================================================
// AdminArticles — liste éditoriale (filtres, actions groupées) +
// ArticleEditor : formulaire premium avec éditeur visuel (WYSIWYG)
// et assistant SEO (§13.2). Contenu stocké en HTML.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import {
  ARTICLE_STATUS_LABELS,
  type ArticlePayload,
  type CategoryPayload,
  type TypographyOptionPayload,
  type UserPayload,
} from '@/lib/types'
import {
  computeSeo,
  markdownToHtml,
  readingTimeFromText,
  slugifySeo,
} from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
import { RichEditor } from './RichEditor'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_ORDER = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'] as const
const ARTICLE_TYPES = ['article', 'analyse', 'interview', 'tribune', 'chronique']
const TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  analyse: 'Analyse',
  interview: 'Interview',
  tribune: 'Tribune',
  chronique: 'Chronique',
}

function flattenCategories(tree: CategoryPayload[]): CategoryPayload[] {
  const out: CategoryPayload[] = []
  const walk = (nodes: CategoryPayload[], depth: number) => {
    for (const node of nodes) {
      out.push({ ...node, name: depth > 0 ? `${'　'.repeat(depth)}↳ ${node.name}` : node.name })
      if (node.children?.length) walk(node.children, depth + 1)
    }
  }
  walk(tree, 0)
  return out
}

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

function SeoChip({ score }: { score: number }) {
  const cls =
    score >= 80
      ? 'bg-marque-clair text-marque dark:bg-marque/15'
      : score >= 50
        ? 'bg-jaune-clair text-yellow-900 dark:text-jaune'
        : 'bg-rouge-clair text-rouge'
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', cls)}>SEO {score}</span>
}

// =====================================================================
// Liste des articles
// =====================================================================

function ArticlesList() {
  const { navigate, session } = useAppStore()
  const { toast } = useToast()

  const [articles, setArticles] = useState<ArticlePayload[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [listError, setListError] = useState<string | null>(null)

  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('')
  const [author, setAuthor] = useState('')
  const [order, setOrder] = useState<'recent' | 'views'>('recent')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [categories, setCategories] = useState<CategoryPayload[]>([])
  const [users, setUsers] = useState<UserPayload[]>([])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const canAssignAuthor = session?.role === 'admin' || session?.role === 'editor_in_chief'

  // debounce de la recherche
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories?all=1')
      .then((d) => {
        if (!cancelled) setCategories(flattenCategories(d.categories ?? []))
      })
      .catch(() => undefined)
    if (canAssignAuthor) {
      api
        .get<{ users: UserPayload[] }>('/api/users')
        .then((d) => {
          if (!cancelled) setUsers(d.users ?? [])
        })
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [canAssignAuthor])

  const loadList = useCallback(() => {
    const params = new URLSearchParams()
    params.set('status', status)
    params.set('page', String(page))
    params.set('limit', '15')
    params.set('order', order)
    if (category) params.set('category', category)
    if (author) params.set('author', author)
    if (search) params.set('search', search)
    setArticles(null)
    api
      .get<{ articles: ArticlePayload[]; total: number; page: number; pages: number }>(`/api/articles?${params.toString()}`)
      .then((d) => {
        setArticles(d.articles ?? [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
        setListError(null)
      })
      .catch((err: unknown) => {
        setArticles([])
        setListError(errMessage(err))
      })
  }, [status, page, order, category, author, search])

  useEffect(() => {
    loadList()
  }, [loadList])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = !!articles && articles.length > 0 && articles.every((a) => selected.has(a.id))

  const bulkStatus = async (newStatus: string) => {
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map((id) => api.put(`/api/articles/${id}`, { status: newStatus })))
    const okCount = results.filter((r) => r.status === 'fulfilled').length
    setBulkBusy(false)
    setSelected(new Set())
    if (okCount === ids.length) {
      toast({ title: 'Mise à jour effectuée', description: `${okCount} article(s) → ${ARTICLE_STATUS_LABELS[newStatus] ?? newStatus}.` })
    } else {
      toast({ title: 'Mise à jour partielle', description: `${okCount}/${ids.length} article(s) mis à jour.`, variant: 'destructive' })
    }
    loadList()
  }

  const bulkDelete = async () => {
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map((id) => api.del(`/api/articles/${id}`)))
    const okCount = results.filter((r) => r.status === 'fulfilled').length
    setBulkBusy(false)
    setSelected(new Set())
    toast({
      title: okCount === ids.length ? 'Corbeille mise à jour' : 'Suppression partielle',
      description: `${okCount}/${ids.length} article(s) mis à la corbeille.`,
      variant: okCount === ids.length ? 'default' : 'destructive',
    })
    loadList()
  }

  const duplicate = async (a: ArticlePayload) => {
    try {
      await api.post('/api/articles', {
        title: `${a.title} (copie)`,
        type: a.type,
        subtitle: a.subtitle ?? null,
        lede: a.lede ?? null,
        content: a.content,
        coverImageUrl: a.coverImageUrl ?? null,
        coverCaption: a.coverCaption ?? null,
        coverCredit: a.coverCredit ?? null,
        categoryId: a.categoryId ?? null,
        status: 'draft',
        commentsOpen: a.commentsOpen,
        isFeatured: false,
        featuredRank: null,
        metaTitle: a.metaTitle ?? null,
        metaDescription: a.metaDescription ?? null,
        metaKeywords: a.metaKeywords ?? null,
        ogImageUrl: a.ogImageUrl ?? null,
        fontId: a.fontId ?? null,
        tags: (a.tags ?? []).map((t) => t.name),
      })
      toast({ title: 'Article dupliqué', description: `« ${a.title} (copie) » créé en brouillon.` })
      loadList()
    } catch (err: unknown) {
      toast({ title: 'Duplication impossible', description: errMessage(err), variant: 'destructive' })
    }
  }

  const trash = async (a: ArticlePayload) => {
    try {
      await api.del(`/api/articles/${a.id}`)
      toast({ title: 'Article mis à la corbeille', description: a.title })
      loadList()
    } catch (err: unknown) {
      toast({ title: 'Suppression impossible', description: errMessage(err), variant: 'destructive' })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Articles"
        description="Rédaction, relecture, planification et publication des contenus écrits."
        actions={
          <Button onClick={() => navigate({ name: 'admin', section: 'articles', id: 'new' })} className="min-h-[40px]">
            <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nouvel article
          </Button>
        }
      />

      {/* Filtres */}
      <SectionCard contentClassName="p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher un titre…"
              className="pl-8"
              aria-label="Rechercher un article"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="Filtrer par statut"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{ARTICLE_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={category || 'all-cat'}
            onValueChange={(v) => {
              setCategory(v === 'all-cat' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="Filtrer par rubrique"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all-cat">Toutes les rubriques</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canAssignAuthor ? (
            <Select
              value={author || 'all-auth'}
              onValueChange={(v) => {
                setAuthor(v === 'all-auth' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label="Filtrer par auteur"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-auth">Tous les auteurs</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            value={order}
            onValueChange={(v) => {
              setOrder(v as 'recent' | 'views')
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="Trier"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Plus récents</SelectItem>
              <SelectItem value="views">Plus vus</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* Barre d'actions groupées */}
      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm">
          <Badge variant="secondary">{selected.size} sélectionné(s)</Badge>
          <Button size="sm" disabled={bulkBusy} onClick={() => void bulkStatus('published')}>
            Publier
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus('review')}>
            Passer en relecture
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus('archived')}>
            Archiver
          </Button>
          <ConfirmAction
            title="Mettre à la corbeille ?"
            description={`${selected.size} article(s) seront retirés du site. Cette action est réversible par un administrateur.`}
            confirmLabel="Mettre à la corbeille"
            onConfirm={() => bulkDelete()}
            trigger={
              <Button size="sm" variant="outline" className="text-rouge" disabled={bulkBusy}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Corbeille
              </Button>
            }
          />
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Annuler la sélection
          </Button>
        </div>
      ) : null}

      {/* Tableau */}
      {listError ? (
        <SectionCard><p className="text-sm text-rouge">{listError}</p></SectionCard>
      ) : !articles ? (
        <ListSkeleton rows={6} />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun article ne correspond à ces filtres"
          description="Modifiez les filtres ou créez un nouvel article."
          action={
            <Button onClick={() => navigate({ name: 'admin', section: 'articles', id: 'new' })}>Créer un article</Button>
          }
        />
      ) : (
        <SectionCard contentClassName="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        setSelected(checked ? new Set(articles.map((a) => a.id)) : new Set())
                      }}
                      aria-label="Tout sélectionner"
                    />
                  </TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead className="hidden md:table-cell">Rubrique</TableHead>
                  <TableHead className="hidden lg:table-cell">Auteur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell">SEO</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Vues</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate({ name: 'admin', section: 'articles', id: a.id })}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} aria-label={`Sélectionner ${a.title}`} />
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">{a.category?.name ?? '—'} · {a.author ? `${a.author.firstName} ${a.author.lastName}` : '—'}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.category ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="h-2 w-2 rounded-full" style={{ background: a.category.color }} aria-hidden="true" />
                          {a.category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {a.author ? `${a.author.firstName} ${a.author.lastName}` : '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="hidden sm:table-cell"><SeoChip score={a.seoScore ?? 0} /></TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{a.views.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {new Date(a.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions pour ${a.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => navigate({ name: 'admin', section: 'articles', id: a.id })}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void duplicate(a)}>
                            <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rouge focus:text-rouge" onSelect={(e) => e.preventDefault()} asChild>
                            <ConfirmAction
                              title="Mettre cet article à la corbeille ?"
                              description={`« ${a.title} » sera retiré du site. Les statistiques sont conservées.`}
                              confirmLabel="Mettre à la corbeille"
                              onConfirm={() => trash(a)}
                              trigger={
                                <button type="button" className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-rouge outline-none transition-colors hover:bg-rouge-clair">
                                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Mettre à la corbeille
                                </button>
                              }
                            />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pages > 1 ? (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <span className="text-muted-foreground">
                Page {page} sur {pages} — {total} article(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                  Suivant
                </Button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      )}
    </div>
  )
}

// =====================================================================
// Assistant SEO — panneau réutilisable de l'éditeur
// =====================================================================

function SeoGauge({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const color = score >= 80 ? 'var(--marque)' : score >= 50 ? 'var(--jaune)' : 'var(--rouge)'
  const label = score >= 80 ? 'Bon' : score >= 50 ? 'Moyen' : 'À améliorer'
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Score SEO : ${score} sur 100`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function CheckIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-marque" aria-hidden="true" />
  if (status === 'warn') return <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-jaune" aria-hidden="true" />
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rouge" aria-hidden="true" />
}

function CharCounter({ length, min, max, softMin, softMax }: { length: number; min: number; max: number; softMin: number; softMax: number }) {
  const cls =
    length >= min && length <= max
      ? 'text-marque'
      : length >= softMin && length <= softMax
        ? 'text-yellow-600 dark:text-jaune'
        : 'text-rouge'
  return (
    <span className={cn('text-xs font-medium tabular-nums', cls)}>
      {length} caractères (idéal {min}–{max})
    </span>
  )
}

// =====================================================================
// ArticleEditor — création / édition complète d'un article
// =====================================================================

export interface ArticleEditorProps {
  articleId: string // 'new' ou UUID
}

interface FormState {
  title: string
  slug: string
  subtitle: string
  lede: string
  content: string
  status: string
  scheduledAt: string
  categoryId: string
  type: string
  authorId: string
  isFeatured: boolean
  featuredRank: string
  commentsOpen: boolean
  fontId: string
  tags: string[]
  coverImageUrl: string
  coverCaption: string
  coverCredit: string
  keyword: string
  metaTitle: string
  metaDescription: string
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  subtitle: '',
  lede: '',
  content: '',
  status: 'draft',
  scheduledAt: '',
  categoryId: '',
  type: 'article',
  authorId: '',
  isFeatured: false,
  featuredRank: '',
  commentsOpen: true,
  fontId: '',
  tags: [],
  coverImageUrl: '',
  coverCaption: '',
  coverCredit: '',
  keyword: '',
  metaTitle: '',
  metaDescription: '',
}

export function ArticleEditor({ articleId }: ArticleEditorProps) {
  const isEdit = articleId !== 'new'
  const { navigate, session } = useAppStore()
  const { toast } = useToast()
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [editorUploading, setEditorUploading] = useState(false)

  const [categories, setCategories] = useState<CategoryPayload[]>([])
  const [fonts, setFonts] = useState<TypographyOptionPayload[]>([])
  const [users, setUsers] = useState<UserPayload[]>([])

  const role = session?.role ?? 'journalist'
  const canAssignAuthor = role === 'admin' || role === 'editor_in_chief'
  const canChooseStatus = role !== 'journalist'
  // Un journaliste propose brouillon / relecture — mais s'il ouvre un article
  // déjà publié (ou approuvé), ce statut doit rester visible et sélectionnable.
  const availableStatuses: readonly string[] = canChooseStatus
    ? STATUS_ORDER
    : ['draft', 'review'].includes(form.status)
      ? (['draft', 'review'] as const)
      : ([...new Set(['draft', 'review', form.status])] as string[])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  // ---- Chargement des données de référence ----
  useEffect(() => {
    let cancelled = false
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories?all=1')
      .then((d) => {
        if (!cancelled) setCategories(flattenCategories(d.categories ?? []))
      })
      .catch(() => undefined)
    api
      .get<{ options: TypographyOptionPayload[] }>('/api/typography')
      .then((d) => {
        if (!cancelled) setFonts(d.options ?? [])
      })
      .catch(() => undefined)
    if (canAssignAuthor) {
      api
        .get<{ users: UserPayload[] }>('/api/users')
        .then((d) => {
          if (!cancelled) setUsers(d.users ?? [])
        })
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [canAssignAuthor])

  // ---- Chargement de l'article à éditer ----
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    setLoading(true)
    api
      .get<{ article: ArticlePayload }>(`/api/articles/${articleId}`)
      .then((d) => {
        if (cancelled) return
        const a = d.article
        setForm({
          title: a.title,
          slug: a.slug,
          subtitle: a.subtitle ?? '',
          lede: a.lede ?? '',
          // Les articles historiques sont en markdown : on les convertit en
          // HTML pour l'éditeur visuel (markdownToHtml renvoie le HTML tel quel).
          content: markdownToHtml(a.content),
          status: a.status,
          scheduledAt: isoToLocalInput(a.scheduledAt),
          categoryId: a.categoryId ?? '',
          type: a.type || 'article',
          authorId: a.authorId ?? '',
          isFeatured: a.isFeatured,
          featuredRank: a.featuredRank != null ? String(a.featuredRank) : '',
          commentsOpen: a.commentsOpen,
          fontId: a.fontId ?? '',
          tags: (a.tags ?? []).map((t) => t.name),
          coverImageUrl: a.coverImageUrl ?? '',
          coverCaption: a.coverCaption ?? '',
          coverCredit: a.coverCredit ?? '',
          keyword: a.metaKeywords ?? '',
          metaTitle: a.metaTitle ?? '',
          metaDescription: a.metaDescription ?? '',
        })
        setSlugTouched(true)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(errMessage(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [articleId, isEdit])

  // ---- Slug auto (uniquement si non modifié manuellement) ----
  const handleTitle = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugifySeo(title),
    }))
  }

  // ---- Score SEO live ----
  const seo = useMemo(
    () =>
      computeSeo({
        title: form.title,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        slug: form.slug,
        keyword: form.keyword,
        content: form.content,
        hasImage: !!form.coverImageUrl,
        imageHasAlt: !!form.coverCaption,
        categoryId: form.categoryId || null,
        hasInternalLink: /href="\/(?!\/)/.test(form.content) || form.content.includes('](/'),
        hasExternalLink: /https?:\/\/|href="https?:/.test(form.content),
        kind: 'article',
        hasTranscription: true,
      }),
    [form]
  )

  // ---- Import de l'image à la une depuis l'appareil ----
  const uploadCover = async (file: File) => {
    setCoverUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Téléversement impossible')
      set('coverImageUrl', data.url)
      toast({ title: 'Image à la une importée', description: file.name })
    } catch (err: unknown) {
      toast({
        title: 'Import impossible',
        description: err instanceof Error ? err.message : errMessage(err),
        variant: 'destructive',
      })
    } finally {
      setCoverUploading(false)
    }
  }

  // ---- Enregistrement ----
  const buildPayload = (forcedStatus?: string) => {
    const status = forcedStatus ?? form.status
    return {
      title: form.title.trim(),
      slug: form.slug || undefined,
      type: form.type,
      subtitle: form.subtitle || null,
      lede: form.lede || null,
      content: form.content,
      coverImageUrl: form.coverImageUrl || null,
      coverCaption: form.coverCaption || null,
      coverCredit: form.coverCredit || null,
      categoryId: form.categoryId || null,
      ...(canAssignAuthor && form.authorId ? { authorId: form.authorId } : {}),
      status,
      scheduledAt: status === 'scheduled' ? localInputToIso(form.scheduledAt) : null,
      publishedAt: undefined,
      isFeatured: form.isFeatured,
      featuredRank: form.isFeatured && form.featuredRank !== '' ? Number(form.featuredRank) : null,
      commentsOpen: form.commentsOpen,
      fontId: form.fontId || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      metaKeywords: form.keyword || null,
      readingTime: readingTimeFromText(form.content),
      seoScore: seo.score,
      tags: form.tags,
    }
  }

  const save = async (forcedStatus?: string) => {
    if (!form.title.trim()) {
      toast({ title: 'Titre requis', description: 'Le titre est obligatoire pour enregistrer.', variant: 'destructive' })
      return
    }
    if ((forcedStatus ?? form.status) === 'scheduled' && !form.scheduledAt) {
      toast({ title: 'Date de planification requise', description: 'Choisissez la date et l’heure de publication.', variant: 'destructive' })
      return
    }
    if (coverUploading || editorUploading) {
      toast({ title: 'Import en cours', description: 'Attendez la fin du téléversement de l’image.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/api/articles/${articleId}`, buildPayload(forcedStatus))
        toast({
          title: forcedStatus === 'published' ? 'Article publié' : 'Article enregistré',
          description:
            forcedStatus === 'published'
              ? 'Il est visible immédiatement sur le site.'
              : 'Les modifications sont enregistrées.',
        })
      } else {
        await api.post('/api/articles', buildPayload(forcedStatus))
        toast({
          title: forcedStatus === 'published' ? 'Article publié' : 'Article créé',
          description:
            forcedStatus === 'published'
              ? 'Il est visible immédiatement sur le site.'
              : forcedStatus === 'review'
                ? 'Soumis à la validation de la rédaction en chef.'
                : 'Brouillon enregistré.',
        })
      }
      navigate({ name: 'admin', section: 'articles' })
    } catch (err: unknown) {
      toast({ title: 'Enregistrement impossible', description: errMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ---- Tags ----
  const addTag = () => {
    const name = tagInput.trim()
    if (!name) return
    if (!form.tags.includes(name)) set('tags', [...form.tags, name])
    setTagInput('')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Article introuvable"
        description={loadError}
        action={<Button variant="outline" onClick={() => navigate({ name: 'admin', section: 'articles' })}>Retour à la liste</Button>}
      />
    )
  }

  const metaTitleValue = form.metaTitle || form.title
  const previewImage = form.coverImageUrl

  const busy = saving || coverUploading || editorUploading

  return (
    <div className="space-y-4">
      <PageHeader
        title={isEdit ? 'Modifier l’article' : 'Nouvel article'}
        description={isEdit ? form.title || 'Chargement…' : 'Rédigez, mettez en forme et publiez en un clic.'}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ name: 'admin', section: 'articles' })}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Retour
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void save('draft')}>
              Enregistrer brouillon
            </Button>
            {canChooseStatus ? (
              <Button disabled={busy} onClick={() => void save('published')}>
                <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {saving ? 'Publication…' : 'Publier'}
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void save('review')}>
                <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {saving ? 'Envoi…' : 'Soumettre en relecture'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ============ Colonne principale ============ */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard contentClassName="space-y-4 p-4 md:p-6">
            <div className="space-y-1.5">
              <Label htmlFor="art-title">Titre</Label>
              <Input
                id="art-title"
                value={form.title}
                onChange={(e) => handleTitle(e.target.value)}
                placeholder="Titre de l’article"
                className="h-12 text-lg font-semibold"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Slug :</span>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', e.target.value)
                  }}
                  className="h-7 w-64 text-xs"
                  aria-label="Slug de l'article"
                />
                <span className="text-[11px] text-muted-foreground">/articles/{form.slug || '…'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-subtitle">Sous-titre</Label>
              <Input
                id="art-subtitle"
                value={form.subtitle}
                onChange={(e) => set('subtitle', e.target.value)}
                placeholder="Accroche secondaire (optionnelle)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-lede">Chapeau</Label>
              <Textarea
                id="art-lede"
                value={form.lede}
                onChange={(e) => set('lede', e.target.value)}
                placeholder="Résumé d’introduction affiché en tête d’article."
                rows={3}
              />
            </div>

            {/* ---- Contenu : éditeur visuel (mise en forme immédiate) ---- */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Contenu</Label>
                <p className="text-xs text-muted-foreground">
                  La mise en forme s&apos;applique directement à l&apos;écran — images importées depuis
                  votre appareil, vidéos YouTube intégrées par simple lien.
                </p>
              </div>
              <RichEditor
                value={form.content}
                onChange={(html) => set('content', html)}
                onImageUploadingChange={setEditorUploading}
              />
              <p className="text-xs text-muted-foreground">
                Astuce : le bouton <strong>Audio</strong> intègre un épisode FM (son slug) — le lecteur
                s&apos;affiche dans la page publique de l&apos;article.
              </p>
            </div>
          </SectionCard>

          {/* ============ Assistant SEO (§13.2) ============ */}
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-marque" aria-hidden="true" />
                Assistant SEO
              </span>
            }
            description="Score calculé en direct selon la grille éditoriale. Le score est enregistré avec l’article."
          >
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="seo-kw">Mot-clé principal</Label>
                  <Input
                    id="seo-kw"
                    value={form.keyword}
                    onChange={(e) => set('keyword', e.target.value)}
                    placeholder="ex. réforme des retraites"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seo-title">Titre SEO</Label>
                  <Input
                    id="seo-title"
                    value={form.metaTitle}
                    onChange={(e) => set('metaTitle', e.target.value)}
                    placeholder={form.title || 'Titre affiché dans Google'}
                  />
                  <CharCounter length={metaTitleValue.length} min={50} max={60} softMin={40} softMax={70} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-desc">Méta-description</Label>
                <Textarea
                  id="seo-desc"
                  value={form.metaDescription}
                  onChange={(e) => set('metaDescription', e.target.value)}
                  placeholder="Résumé affiché sous le lien dans les résultats de recherche."
                  rows={3}
                />
                <CharCounter length={form.metaDescription.length} min={120} max={160} softMin={80} softMax={180} />
              </div>

              <Separator />

              <div className="flex flex-col gap-4 sm:flex-row">
                <SeoGauge score={seo.score} />
                <ul className="scroll-slim max-h-56 flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm">
                  {seo.checks.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <CheckIcon status={c.status} />
                      <span>
                        {c.label}
                        {c.hint ? <span className="ml-1 text-xs text-muted-foreground">({c.hint})</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Aperçu résultat Google */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu dans les résultats de recherche</p>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm text-muted-foreground">exemple.fr › articles › {form.slug || 'votre-article'}</p>
                  <p className="mt-0.5 text-lg font-medium text-marque underline decoration-marque/50 underline-offset-2">
                    {metaTitleValue || 'Votre titre apparaîtra ici'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {form.metaDescription || 'La méta-description choisie s’affichera ici — soignez-la : c’est l’argument de clic.'}
                  </p>
                </div>
              </div>

              {/* Aperçu carte sociale */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu du partage (réseaux sociaux)</p>
                <div className="overflow-hidden rounded-lg border">
                  {previewImage ? (
                     
                    <img src={previewImage} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-marque-clair to-jaune-clair text-xs text-muted-foreground">
                      Image à la une non définie
                    </div>
                  )}
                  <div className="bg-muted/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">exemple.fr</p>
                    <p className="truncate text-sm font-semibold">{metaTitleValue || 'Titre de l’article'}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{form.metaDescription || form.lede || 'Description du partage social.'}</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ============ Colonne réglages ============ */}
        <div className="scroll-slim space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
          <SectionCard title="Publication">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="art-status">Statut</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger id="art-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{ARTICLE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canChooseStatus ? (
                  <p className="text-xs text-muted-foreground">Journaliste : brouillon et relecture — la validation relève de la rédaction en chef.</p>
                ) : null}
              </div>
              {form.status === 'scheduled' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="art-sched">Publication planifiée</Label>
                  <Input
                    id="art-sched"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => set('scheduledAt', e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Classement">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Rubrique</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => set('categoryId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir une rubrique" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans rubrique</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type de contenu</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ARTICLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Auteur</Label>
                {canAssignAuthor ? (
                  <Select value={form.authorId || session?.id || 'none'} onValueChange={(v) => set('authorId', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-md bg-muted px-3 py-2 text-sm">
                    {session?.firstName} {session?.lastName}
                    <span className="ml-1 text-xs text-muted-foreground">(vous êtes l’auteur)</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="art-tags">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => set('tags', form.tags.filter((x) => x !== t))}
                        aria-label={`Retirer le tag ${t}`}
                        className="rounded-full hover:text-rouge"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  id="art-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Ajouter un tag puis Entrée"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Mise en avant & options">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">À la une</p>
                  <p className="text-xs text-muted-foreground">Compose la Une de la page d’accueil.</p>
                </div>
                <Switch checked={form.isFeatured} onCheckedChange={(v) => set('isFeatured', v)} aria-label="À la une" />
              </div>
              {form.isFeatured ? (
                <div className="space-y-1.5">
                  <Label htmlFor="art-rank">Rang d’affichage (1 = premier)</Label>
                  <Input
                    id="art-rank"
                    type="number"
                    min={1}
                    value={form.featuredRank}
                    onChange={(e) => set('featuredRank', e.target.value)}
                    placeholder="1"
                  />
                </div>
              ) : null}
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Commentaires ouverts</p>
                  <p className="text-xs text-muted-foreground">Les lecteurs peuvent commenter (après modération).</p>
                </div>
                <Switch checked={form.commentsOpen} onCheckedChange={(v) => set('commentsOpen', v)} aria-label="Commentaires ouverts" />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Police d’affichage de l’article</Label>
                <Select value={form.fontId || 'default'} onValueChange={(v) => set('fontId', v === 'default' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Défaut</SelectItem>
                    {fonts.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Typographie spécifique pour cet article (§17.4).</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Image à la une">
            <div className="space-y-3">
              {form.coverImageUrl ? (
                <img src={form.coverImageUrl} alt="Aperçu de l'image à la une" className="aspect-video w-full rounded-lg border object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/50 text-xs text-muted-foreground">
                  Aucune image importée
                </div>
              )}
              {/* Import direct depuis l'appareil — plus de saisie d'URL */}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void uploadCover(file)
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={coverUploading}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {coverUploading ? 'Import en cours…' : 'Importer une image'}
                </Button>
                {form.coverImageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] text-rouge hover:text-rouge"
                    disabled={coverUploading}
                    onClick={() => set('coverImageUrl', '')}
                  >
                    <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Retirer
                  </Button>
                ) : null}
              </div>
              <Input
                value={form.coverCaption}
                onChange={(e) => set('coverCaption', e.target.value)}
                placeholder="Légende (utilisée comme texte alternatif)"
                aria-label="Légende de l'image"
              />
              <Input
                value={form.coverCredit}
                onChange={(e) => set('coverCredit', e.target.value)}
                placeholder="Crédit photo"
                aria-label="Crédit photo"
              />
            </div>
          </SectionCard>

          <div className="flex gap-2">
            {canChooseStatus ? (
              <Button className="flex-1" disabled={busy} onClick={() => void save('published')}>
                <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {saving ? 'Publication…' : 'Publier'}
              </Button>
            ) : (
              <Button className="flex-1" disabled={busy} onClick={() => void save('review')}>
                <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {saving ? 'Envoi…' : 'Soumettre en relecture'}
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={() => void save()}>
              Enregistrer
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => navigate({ name: 'admin', section: 'articles' })}>
              Retour liste
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// Point d'entrée de la section Articles
// =====================================================================

export default function AdminArticles() {
  const view = useAppStore((s) => s.view)
  const id = view.name === 'admin' ? view.id : undefined
  if (id === 'new') return <ArticleEditor key="new" articleId="new" />
  if (id && UUID_RE.test(id)) return <ArticleEditor key={id} articleId={id} />
  return <ArticlesList />
}
