'use client'

// =====================================================================
// AdminCategories — arborescence des rubriques (création, édition,
// réordonnancement, activation, suppression)
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  Earth,
  FolderOpen,
  FolderTree,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  MicVocal,
  MoreHorizontal,
  Newspaper,
  Palette,
  Pencil,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { CategoryPayload } from '@/lib/types'
import { slugify } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState, ListSkeleton, PageHeader, ConfirmAction, errMessage } from './admin-ui'

const ICON_OPTIONS: Record<string, LucideIcon> = {
  Newspaper,
  Globe,
  Landmark,
  Users,
  TrendingUp,
  Palette,
  Trophy,
  GraduationCap,
  HeartPulse,
  Cpu,
  Scale,
  AlertTriangle,
  FolderOpen,
  MicVocal,
  Brain,
  Earth,
}

interface CategoryNode extends CategoryPayload {
  children?: CategoryPayload[]
  depth: number
  expanded: boolean
}

interface FlatRow {
  category: CategoryPayload
  depth: number
  hasChildren: boolean
  expanded: boolean
  siblingIds: string[]
}

interface FormState {
  id: string | null
  name: string
  slug: string
  parentId: string
  color: string
  icon: string
  description: string
  imageUrl: string
  visibleMenu: boolean
  visibleHome: boolean
  active: boolean
  metaTitle: string
  metaDescription: string
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  slug: '',
  parentId: '',
  color: '#0A0A0A',
  icon: 'Newspaper',
  description: '',
  imageUrl: '',
  visibleMenu: true,
  visibleHome: true,
  active: true,
  metaTitle: '',
  metaDescription: '',
}

export default function AdminCategories() {
  const { toast } = useToast()
  const { settings } = useAppStore()

  const [tree, setTree] = useState<CategoryPayload[] | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadTree = useCallback(() => {
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories?all=1')
      .then((d) => {
        setTree(d.categories ?? [])
        // déplier le premier niveau par défaut
        setExpanded(new Set((d.categories ?? []).map((c) => c.id)))
      })
      .catch((err: unknown) => {
        setTree([])
        toast({ title: 'Chargement impossible', description: errMessage(err), variant: 'destructive' })
      })
  }, [toast])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  const rows = useMemo<FlatRow[]>(() => {
    if (!tree) return []
    const out: FlatRow[] = []
    const walk = (nodes: CategoryPayload[], depth: number, siblingIds: string[]) => {
      for (const c of nodes) {
        const hasChildren = !!c.children?.length
        out.push({ category: c, depth, hasChildren, expanded: expanded.has(c.id), siblingIds })
        if (hasChildren && expanded.has(c.id)) walk(c.children as CategoryPayload[], depth + 1, (c.children as CategoryPayload[]).map((x) => x.id))
      }
    }
    walk(tree, 0, tree.map((c) => c.id))
    return out
  }, [tree, expanded])

  const rootCategories = useMemo(() => (tree ?? []).map((c) => ({ id: c.id, name: c.name })), [tree])

  const totalCount = (c: CategoryPayload): number => {
    const own = c._count ? c._count.articles + c._count.audioContents + c._count.videos : 0
    return own + (c.children ?? []).reduce((acc, ch) => acc + totalCount(ch), 0)
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- Activation inline ----
  const setActive = async (c: CategoryPayload, active: boolean) => {
    try {
      await api.put(`/api/categories/${c.id}`, { active })
      toast({ title: active ? 'Rubrique activée' : 'Rubrique désactivée', description: c.name })
      loadTree()
    } catch (err: unknown) {
      toast({ title: 'Modification impossible', description: errMessage(err), variant: 'destructive' })
    }
  }

  // ---- Réordonnancement au sein des mêmes sœurs ----
  const move = async (row: FlatRow, direction: 'up' | 'down') => {
    const idx = row.siblingIds.indexOf(row.category.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= row.siblingIds.length) return
    const nodes = row.depth === 0 ? (tree ?? []) : findSiblings(tree ?? [], row.category.parentId ?? null)
    const a = nodes[row.siblingIds.indexOf(row.category.id)]
    const b = nodes[targetIdx]
    if (!a || !b) return
    try {
      await Promise.all([
        api.put(`/api/categories/${a.id}`, { order: b.order ?? 0 }),
        api.put(`/api/categories/${b.id}`, { order: a.order ?? 0 }),
      ])
      toast({ title: 'Ordre mis à jour' })
      loadTree()
    } catch (err: unknown) {
      toast({ title: 'Réordonnancement impossible', description: errMessage(err), variant: 'destructive' })
    }
  }

  const findSiblings = (nodes: CategoryPayload[], parentId: string | null): CategoryPayload[] => {
    for (const n of nodes) {
      if (n.id === parentId) return n.children ?? []
      const found = findSiblings(n.children ?? [], parentId)
      if (found.length) return found
    }
    return []
  }

  // ---- Dialog ----
  const openCreate = (parentId?: string) => {
    setForm({ ...EMPTY_FORM, parentId: parentId ?? '' })
    setSlugTouched(false)
    setDialogOpen(true)
  }

  const openEdit = (c: CategoryPayload) => {
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ?? '',
      color: c.color || '#0A0A0A',
      icon: c.icon || 'Newspaper',
      description: c.description ?? '',
      imageUrl: c.imageUrl ?? '',
      visibleMenu: c.visibleMenu,
      visibleHome: c.visibleHome,
      active: c.active,
      metaTitle: c.metaTitle ?? '',
      metaDescription: c.metaDescription ?? '',
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
      parentId: form.parentId || null,
      color: form.color,
      icon: form.icon,
      description: form.description || null,
      imageUrl: form.imageUrl || null,
      visibleMenu: form.visibleMenu,
      visibleHome: form.visibleHome,
      active: form.active,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
    }
    try {
      if (form.id) {
        await api.put(`/api/categories/${form.id}`, payload)
        toast({ title: 'Rubrique mise à jour', description: form.name })
      } else {
        await api.post('/api/categories', payload)
        toast({ title: 'Rubrique créée', description: form.name })
      }
      setDialogOpen(false)
      loadTree()
    } catch (err: unknown) {
      toast({ title: 'Enregistrement impossible', description: errMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (c: CategoryPayload) => {
    try {
      await api.del(`/api/categories/${c.id}`)
      toast({ title: 'Rubrique supprimée', description: c.name })
      loadTree()
    } catch (err: unknown) {
      // 409 : contenus ou sous-rubriques rattachés — le message de l'API est explicite
      toast({ title: 'Suppression impossible', description: errMessage(err), variant: 'destructive' })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rubriques"
        description="Arborescence des sections du site : menu, accueil, couleurs et icônes."
        actions={
          <Button onClick={() => openCreate()} className="min-h-[40px]">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nouvelle rubrique
          </Button>
        }
      />

      {!tree ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="Aucune rubrique"
          description="Créez votre première rubrique pour organiser les contenus."
          action={<Button onClick={() => openCreate()}>Créer une rubrique</Button>}
        />
      ) : (
        <div className="space-y-1">
          {rows.map(({ category: c, depth, hasChildren, expanded: isOpen, siblingIds }) => {
            const Icon = ICON_OPTIONS[c.icon ?? ''] ?? FolderTree
            const idx = siblingIds.indexOf(c.id)
            return (
              <div
                key={c.id}
                className={cn(
                  'group flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-marque/40 md:flex-nowrap'
                )}
                style={{ marginLeft: depth > 0 ? `${depth * 1.5}rem` : undefined }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                    aria-label={isOpen ? `Replier ${c.name}` : `Déplier ${c.name}`}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                ) : (
                  <span className="h-6 w-6" aria-hidden="true" />
                )}
                <span className="h-3 w-3 shrink-0 rounded-full border" style={{ background: c.color }} aria-hidden="true" />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {c.name}
                    <span className="ml-2 font-normal text-xs text-muted-foreground">/{c.slug}</span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {c.visibleMenu ? <Badge variant="secondary" className="text-[10px]">Menu</Badge> : null}
                    {c.visibleHome ? <Badge variant="secondary" className="text-[10px]">Accueil</Badge> : null}
                    <span className="text-[11px] text-muted-foreground">{totalCount(c)} contenu(s)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">Active</span>
                  <Switch checked={c.active} onCheckedChange={(v) => void setActive(c, v)} aria-label={`Activer ${c.name}`} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions pour ${c.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEdit(c)}>
                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={idx <= 0} onSelect={() => void move({ category: c, depth, hasChildren, expanded: isOpen, siblingIds }, 'up')}>
                        ↑ Monter
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={idx >= siblingIds.length - 1} onSelect={() => void move({ category: c, depth, hasChildren, expanded: isOpen, siblingIds }, 'down')}>
                        ↓ Descendre
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => openCreate(c.id)}>
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Ajouter une sous-rubrique
                      </DropdownMenuItem>
                      <ConfirmAction
                        title="Supprimer cette rubrique ?"
                        description={`« ${c.name} » sera définitivement supprimée. Si des contenus ou des sous-rubriques y sont rattachés, l'opération sera refusée.`}
                        confirmLabel="Supprimer"
                        onConfirm={() => remove(c)}
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
              </div>
            )
          })}
          {settings ? (
            <p className="pt-2 text-xs text-muted-foreground">
              Les rubriques activées avec « Menu » apparaissent dans la navigation publique.
              {settings.moduleFmActive === false ? ' Le module FM étant désactivé, la rubrique audio n’alimente plus la page FM.' : ''}
            </p>
          ) : null}
        </div>
      )}

      {/* ---- Dialog création / édition ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier la rubrique' : 'Nouvelle rubrique'}</DialogTitle>
            <DialogDescription>
              Couleur, icône et visibilité se répercutent immédiatement sur la navigation publique.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nom</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))
                }}
                placeholder="Ex. Politique"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }}
                placeholder="politique"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rubrique parente</Label>
              <Select
                value={form.parentId || 'root'}
                onValueChange={(v) => setForm((f) => ({ ...f, parentId: v === 'root' ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Aucune (rubrique racine)</SelectItem>
                  {rootCategories
                    .filter((r) => r.id !== form.id)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-color">Couleur</Label>
              <div className="flex items-center gap-2">
                <input
                  id="cat-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
                  aria-label="Couleur de la rubrique"
                />
                <span className="text-sm text-muted-foreground">{form.color}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Icône</Label>
              <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ICON_OPTIONS).map(([name, Icon]) => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-image">Image (URL, optionnelle)</Label>
              <Input
                id="cat-image"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Présentation de la rubrique (affichée en page rubrique)."
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cat-menu" className="font-normal">Visible dans le menu</Label>
              <Switch id="cat-menu" checked={form.visibleMenu} onCheckedChange={(v) => setForm((f) => ({ ...f, visibleMenu: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cat-home" className="font-normal">Visible sur l’accueil</Label>
              <Switch id="cat-home" checked={form.visibleHome} onCheckedChange={(v) => setForm((f) => ({ ...f, visibleHome: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cat-active" className="font-normal">Rubrique active</Label>
              <Switch id="cat-active" checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-mt">Titre SEO</Label>
              <Input id="cat-mt" value={form.metaTitle} onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cat-md">Méta-description</Label>
              <Textarea
                id="cat-md"
                value={form.metaDescription}
                onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer la rubrique'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
