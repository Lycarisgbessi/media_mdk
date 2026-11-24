'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  Earth,
  Facebook,
  FolderOpen,
  Globe,
  GraduationCap,
  HeartPulse,
  Instagram,
  Landmark,
  Linkedin,
  Lock,
  Menu,
  MicVocal,
  Moon,
  Newspaper,
  Palette,
  Radio,
  Scale,
  Search,
  Sun,
  TrendingUp,
  Trophy,
  Tv,
  Twitter,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { CategoryPayload, LiveStreamPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ---------- Icônes de rubriques (nom lucide → composant) ----------
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Newspaper,
  Globe,
  AlertTriangle,
  Scale,
  Earth,
  Landmark,
  Users,
  TrendingUp,
  Palette,
  Trophy,
  GraduationCap,
  HeartPulse,
  Cpu,
  MicVocal,
  Brain,
  FolderOpen,
}

function categoryIcon(name?: string | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || FolderOpen
}

// ---------- Logo du média ----------
function BrandMark({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  const settings = useAppStore((s) => s.settings)
  const logo = settings?.logoUrl?.trim() || null
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[44px] items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-marque"
      aria-label="Retour à l'accueil"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-marque shadow-md shadow-marque/25 transition-transform group-hover:scale-105">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              // logo indisponible : retour au monogramme par défaut
              e.currentTarget.style.display = 'none'
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'block'
            }}
          />
        ) : null}
        <span
          className="text-xl font-black leading-none text-white"
          style={{ display: logo ? 'none' : 'block' }}
        >
          M
        </span>
        <span className="live-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-rouge" aria-hidden="true" />
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className={cn('font-black uppercase tracking-wider text-foreground transition-all', compact ? 'text-sm' : 'text-base sm:text-lg')}>
          {settings?.siteName || 'Média'}
        </span>
        {!compact && settings?.slogan && (
          <span className="mt-1 hidden text-[11px] text-muted-foreground sm:block">{settings.slogan}</span>
        )}
      </span>
    </button>
  )
}

// ---------- Lien de navigation (desktop) ----------
function NavLink({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex min-h-[44px] items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold uppercase tracking-wide transition-colors hover:text-marque focus-visible:outline-2 focus-visible:outline-marque',
        active ? 'text-marque' : 'text-foreground/85',
        className
      )}
    >
      {children}
      <span
        className={cn(
          'absolute inset-x-2.5 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-marque transition-transform duration-300',
          active ? 'scale-x-100' : 'hover:scale-x-100'
        )}
        aria-hidden="true"
      />
    </button>
  )
}

/**
 * En-tête public : logo, méga-menu des rubriques, FM/TV, badge EN DIRECT,
 * recherche, bascule sombre, espace pro — tiroir complet sur mobile.
 */
export function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const setSearchOpen = useAppStore((s) => s.setSearchOpen)
  const settings = useAppStore((s) => s.settings)
  const socialLinks = useAppStore((s) => s.socialLinks)
  const view = useAppStore((s) => s.view)
  const { theme, setTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mobileQuery, setMobileQuery] = useState('')
  const [rootCategories, setRootCategories] = useState<CategoryPayload[]>([])
  const [liveId, setLiveId] = useState<string | null>(null)

  const fmActive = settings?.moduleFmActive ?? true
  const tvActive = settings?.moduleTvActive ?? true

  useEffect(() => setMounted(true), [])

  // Réduction du header au défilement
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Rubriques racines visibles dans le menu (méga-menu + tiroir) — §6.1
  useEffect(() => {
    let cancelled = false
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories')
      .then((res) => {
        if (cancelled) return
        const all = Array.isArray(res.categories) ? res.categories : []
        setRootCategories(all.filter((c) => c.active !== false && c.visibleMenu !== false))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Détection d'un direct en cours (rafraîchi toutes les 45 s)
  useEffect(() => {
    let cancelled = false
    const check = () => {
      api
        .get<{ lives: LiveStreamPayload[] }>('/api/lives')
        .then((res) => {
          if (cancelled) return
          const live = (res.lives ?? []).find((l) => l.status === 'live')
          setLiveId(live ? live.id : null)
        })
        .catch(() => {})
    }
    check()
    const timer = setInterval(check, 45000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const directLinks = useMemo(() => rootCategories.slice(0, 6), [rootCategories])
  const goHome = () => navigate({ name: 'home' })

  const socialIconFor = (platform: string): LucideIcon => {
    const p = platform.toLowerCase()
    if (p.includes('twitter') || p === 'x') return Twitter
    if (p.includes('facebook')) return Facebook
    if (p.includes('instagram')) return Instagram
    if (p.includes('linkedin')) return Linkedin
    if (p.includes('youtube')) return Youtube
    return Globe
  }

  const navLinks = (
    <>
      {/* Méga-menu Actualités */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex min-h-[44px] items-center gap-1 rounded-md px-2.5 text-[13px] font-semibold uppercase tracking-wide transition-colors hover:text-marque focus-visible:outline-2 focus-visible:outline-marque',
              view.name === 'home' ? 'text-marque' : 'text-foreground/85'
            )}
          >
            Actualités
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[540px] max-w-[calc(100vw-2rem)] p-3">
          <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Toutes les rubriques
          </p>
          <div className="grid grid-cols-2 gap-1">
            {rootCategories.map((cat) => {
              const Icon = categoryIcon(cat.icon)
              return (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => navigate({ name: 'category', slug: cat.slug })}
                  className="cursor-pointer gap-3 rounded-lg p-2.5 focus:bg-marque-clair dark:focus:bg-marque-clair"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{cat.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {cat._count?.articles ?? 0} article{(cat._count?.articles ?? 0) > 1 ? 's' : ''}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
            {rootCategories.length === 0 && (
              <p className="col-span-2 p-3 text-sm text-muted-foreground">Chargement des rubriques…</p>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {fmActive && (
        <NavLink active={view.name === 'fm'} onClick={() => navigate({ name: 'fm' })}>
          <Radio className="h-4 w-4" aria-hidden="true" />
          FM
        </NavLink>
      )}
      {tvActive && (
        <NavLink active={view.name === 'tv'} onClick={() => navigate({ name: 'tv' })}>
          <Tv className="h-4 w-4" aria-hidden="true" />
          TV
        </NavLink>
      )}

      {directLinks.map((cat, i) => (
        <NavLink
          key={cat.id}
          active={view.name === 'category' && view.slug === cat.slug}
          onClick={() => navigate({ name: 'category', slug: cat.slug })}
          className={cn('max-w-[130px]', i >= 3 && 'hidden 2xl:flex')}
        >
          <span className="truncate">{cat.name}</span>
        </NavLink>
      ))}
    </>
  )

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md transition-[height] duration-300',
        scrolled ? 'h-14' : 'h-16'
      )}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:gap-4 lg:px-6">
        <BrandMark onClick={goHome} compact={scrolled} />

        {/* Navigation desktop */}
        <nav aria-label="Navigation principale" className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-hidden md:flex lg:gap-1">
          {navLinks}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {liveId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ name: 'live', id: liveId })}
              className="mr-1 hidden min-h-[36px] gap-2 rounded-full bg-rouge px-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-rouge/90 hover:text-white sm:inline-flex"
              aria-label="Regarder le direct"
            >
              <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />
              En direct
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher"
            className="h-11 w-11 rounded-full"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="h-11 w-11 rounded-full"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ name: 'admin' })}
            className="ml-1 hidden min-h-[40px] gap-1.5 rounded-full px-4 text-xs font-semibold uppercase tracking-wide md:inline-flex"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Espace pro
          </Button>

          {/* Menu mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Tiroir mobile plein écran */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-full p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <BrandMark onClick={() => { setMenuOpen(false); goHome() }} />
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const q = mobileQuery.trim()
                  if (!q) return
                  setMenuOpen(false)
                  navigate({ name: 'search', q })
                }}
              >
                <Input
                  value={mobileQuery}
                  onChange={(e) => setMobileQuery(e.target.value)}
                  placeholder="Rechercher une actualité…"
                  aria-label="Rechercher"
                  className="h-11"
                />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label="Lancer la recherche">
                  <Search className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>

            <nav aria-label="Menu mobile" className="scroll-slim flex-1 overflow-y-auto p-3">
              <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Rubriques
              </p>
              {rootCategories.map((cat) => {
                const Icon = categoryIcon(cat.icon)
                const hasChildren = (cat.children ?? []).length > 0
                const isOpen = expanded === cat.id
                return (
                  <div key={cat.id}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          navigate({ name: 'category', slug: cat.slug })
                        }}
                        className="flex min-h-[48px] flex-1 items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </button>
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : cat.id)}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? `Replier ${cat.name}` : `Déplier ${cat.name}`}
                        >
                          <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {hasChildren && isOpen && (
                      <div className="ml-[52px] border-l border-border pl-2">
                        {(cat.children ?? []).map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => {
                              setMenuOpen(false)
                              navigate({ name: 'category', slug: child.slug })
                            }}
                            className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              <Separator className="my-3" />

              <div className="space-y-1">
                {fmActive && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate({ name: 'fm' }) }}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-jaune text-black">
                      <Radio className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Radio FM
                  </button>
                )}
                {tvActive && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate({ name: 'tv' }) }}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rouge text-white">
                      <Tv className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Chaîne TV
                  </button>
                )}
                {tvActive && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate({ name: 'live' }) }}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rouge/15 text-rouge">
                      <span className="live-dot h-2.5 w-2.5 rounded-full bg-rouge" aria-hidden="true" />
                    </span>
                    Directs
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate({ name: 'admin' }) }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Espace pro
                </button>
              </div>
            </nav>

            {socialLinks.length > 0 && (
              <div className="border-t p-4">
                <p className="pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Suivez-nous</p>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.filter((s) => s.active).map((s) => {
                    const Icon = socialIconFor(s.platform)
                    return (
                      <a
                        key={s.id}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.platform}
                        className="flex h-11 w-11 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground transition-colors hover:border-marque hover:text-marque"
                      >
                        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden="true" />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
