'use client'

// =====================================================================
// AdminPages — pages institutionnelles (mentions légales, à propos…)
// Liste + éditeur : titre, slug (lecture seule), contenu texte/markdown, méta
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { PagePayload } from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ListSkeleton, PageHeader, SectionCard, errMessage } from './admin-ui'

interface EditorForm {
  title: string
  content: string
  metaTitle: string
  metaDescription: string
}

export default function AdminPages() {
  const { toast } = useToast()

  const [pages, setPages] = useState<PagePayload[] | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [form, setForm] = useState<EditorForm>({ title: '', content: '', metaTitle: '', metaDescription: '' })
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api
      .get<{ pages: PagePayload[] }>('/api/pages')
      .then((d) => {
        const list = d.pages ?? []
        setPages(list)
        setSelectedSlug((current) => current ?? (list.length > 0 ? list[0].slug : null))
      })
      .catch((err: unknown) => {
        setPages([])
        toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const selectedPage = (pages ?? []).find((p) => p.slug === selectedSlug) ?? null

  const selectPage = (slug: string) => {
    const page = (pages ?? []).find((p) => p.slug === slug)
    if (!page) return
    setSelectedSlug(slug)
    setForm({
      title: page.title,
      content: page.content,
      metaTitle: page.metaTitle ?? '',
      metaDescription: page.metaDescription ?? '',
    })
    setUpdatedAt(page.updatedAt)
  }

  const save = async () => {
    if (!selectedSlug) return
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le titre est requis.' })
      return
    }
    setSaving(true)
    try {
      const d = await api.put<{ page: PagePayload }>(`/api/pages/${selectedSlug}`, {
        title: form.title.trim(),
        content: form.content,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
      })
      setUpdatedAt(d.page.updatedAt)
      setPages((prev) =>
        prev
          ? prev.map((p) =>
              p.slug === selectedSlug
                ? {
                    ...p,
                    title: d.page.title,
                    updatedAt: d.page.updatedAt,
                    metaTitle: d.page.metaTitle,
                    metaDescription: d.page.metaDescription,
                  }
                : p
            )
          : prev
      )
      toast({ title: 'Page enregistrée', description: `/${selectedSlug}` })
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pages statiques"
        description="Mentions légales, à propos, charte éditoriale… affichées publiquement sous /page/[slug]."
      />

      {!pages ? (
        <ListSkeleton rows={4} />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune page statique"
          description="Les pages institutionnelles (mentions légales, à propos…) seront créées en base et apparaîtront ici."
        />
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          {/* Sélecteur mobile */}
          <div className="space-y-1.5 md:hidden">
            <Label htmlFor="page-select">Page à éditer</Label>
            <Select value={selectedSlug ?? undefined} onValueChange={selectPage}>
              <SelectTrigger id="page-select" className="min-h-[44px] w-full">
                <SelectValue placeholder="Choisir une page" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Liste latérale (desktop) */}
          <nav className="hidden w-64 shrink-0 md:block" aria-label="Liste des pages">
            <div className="max-h-96 space-y-2 overflow-y-auto scroll-slim pr-1">
              {pages.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => selectPage(p.slug)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    p.slug === selectedSlug
                      ? 'border-marque bg-marque-clair dark:bg-marque/15'
                      : 'bg-card hover:border-marque/40'
                  )}
                >
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">/{p.slug}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Modifiée le {formatDate(p.updatedAt)}</p>
                </button>
              ))}
            </div>
          </nav>

          {/* Éditeur */}
          <div className="min-w-0 flex-1">
            {selectedPage ? (
              <SectionCard
                title="Édition de la page"
                description={`Dernière mise à jour : ${formatDateTime(updatedAt ?? selectedPage.updatedAt)}`}
                actions={
                  <Button className="min-h-[44px]" disabled={saving} onClick={() => void save()}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                }
              >
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="pg-title">Titre</Label>
                      <Input
                        id="pg-title"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pg-slug">Slug (non modifiable)</Label>
                      <Input id="pg-slug" value={selectedPage.slug} readOnly disabled className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-content">Contenu</Label>
                    <Textarea
                      id="pg-content"
                      rows={14}
                      className="font-mono text-sm"
                      value={form.content}
                      onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder="Texte brut ou markdown — envoyé tel quel."
                    />
                    <p className="text-xs text-muted-foreground">Texte brut ou markdown, envoyé tel quel (titres ##, listes - …).</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-mt">Titre SEO</Label>
                    <Input
                      id="pg-mt"
                      value={form.metaTitle}
                      onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-md">Méta-description</Label>
                    <Textarea
                      id="pg-md"
                      rows={3}
                      value={form.metaDescription}
                      onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Dernière mise à jour : {formatDateTime(updatedAt ?? selectedPage.updatedAt)}
                    </p>
                    <Button className="min-h-[44px]" disabled={saving} onClick={() => void save()}>
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <EmptyState
                icon={FileText}
                title="Sélectionnez une page"
                description="Choisissez une page dans la liste pour l'éditer."
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
