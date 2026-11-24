'use client'

// =====================================================================
// AdminShell — coquille du tableau de bord d'administration
// Garde de session, sidebar filtrée par rôle, topbar, zone de contenu
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  DatabaseBackup,
  ExternalLink,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Newspaper,
  Radio,
  ScrollText,
  Settings,
  Tv,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/types'
import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { errMessage } from './admin-ui'

import AdminDashboard from './AdminDashboard'
import AdminArticles from './AdminArticles'
import AdminCategories from './AdminCategories'
import AdminFM from './AdminFM'
import AdminTV from './AdminTV'
import AdminComments from './AdminComments'
import AdminFlash from './AdminFlash'
import AdminAds from './AdminAds'
import AdminContact from './AdminContact'
import AdminUsers from './AdminUsers'
import AdminSettings from './AdminSettings'
import AdminPages from './AdminPages'
import AdminAudit from './AdminAudit'
import AdminBackup from './AdminBackup'

interface SectionDef {
  key: string
  label: string
  icon: LucideIcon
  roles: string[]
  badgeKey?: 'pendingComments' | 'unreadMessages'
}

const ALL_ROLES: string[] = [
  'admin',
  'editor_in_chief',
  'journalist',
  'audio_producer',
  'video_manager',
  'moderator',
  'ad_manager',
]

export const ADMIN_SECTIONS: SectionDef[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ALL_ROLES },
  { key: 'articles', label: 'Articles', icon: Newspaper, roles: ['admin', 'editor_in_chief', 'journalist'] },
  { key: 'categories', label: 'Rubriques', icon: FolderTree, roles: ['admin', 'editor_in_chief'] },
  { key: 'fm', label: 'Radio FM', icon: Radio, roles: ['admin', 'editor_in_chief', 'audio_producer'] },
  { key: 'tv', label: 'Télévision', icon: Tv, roles: ['admin', 'editor_in_chief', 'video_manager'] },
  { key: 'comments', label: 'Commentaires', icon: MessageSquare, roles: ['admin', 'editor_in_chief', 'moderator'], badgeKey: 'pendingComments' },
  { key: 'flash', label: 'Flash info', icon: Zap, roles: ['admin', 'editor_in_chief'] },
  { key: 'ads', label: 'Publicité', icon: Megaphone, roles: ['admin', 'ad_manager'] },
  { key: 'contact', label: 'Messagerie', icon: Inbox, roles: ['admin', 'editor_in_chief', 'moderator'], badgeKey: 'unreadMessages' },
  { key: 'pages', label: 'Pages statiques', icon: FileText, roles: ['admin', 'editor_in_chief'] },
  { key: 'users', label: 'Utilisateurs', icon: Users, roles: ['admin'] },
  { key: 'settings', label: 'Réglages', icon: Settings, roles: ['admin'] },
  { key: 'audit', label: "Journal d'audit", icon: ScrollText, roles: ['admin'] },
  { key: 'backup', label: 'Sauvegarde', icon: DatabaseBackup, roles: ['admin'] },
]

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export default function AdminShell() {
  const { view, navigate, session, sessionLoaded, setSession } = useAppStore()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [badgeCounts, setBadgeCounts] = useState<{ pendingComments: number; unreadMessages: number } | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const currentSection = view.name === 'admin' ? (view.section ?? 'dashboard') : 'dashboard'

  // ---- Garde : session non chargée → attente ; absente → redirection login ----
  useEffect(() => {
    if (sessionLoaded && !session) {
      navigate({ name: 'login' })
    }
  }, [sessionLoaded, session, navigate])

  // ---- Compteurs légers pour les badges latéraux (une seule fois) ----
  useEffect(() => {
    if (!sessionLoaded || !session) return
    let cancelled = false
    api
      .get<{ stats?: DashboardStats } & DashboardStats>('/api/stats')
      .then((data) => {
        if (cancelled) return
        const s = data.stats ?? data
        setBadgeCounts({ pendingComments: s.pendingComments ?? 0, unreadMessages: s.unreadMessages ?? 0 })
      })
      .catch(() => {
        // non bloquant : les badges restent absents
      })
    return () => {
      cancelled = true
    }
  }, [sessionLoaded, session])

  const visibleSections = useMemo(() => {
    if (!session) return []
    return ADMIN_SECTIONS.filter((s) => s.roles.includes(session.role))
  }, [session])

  const activeLabel = useMemo(
    () => visibleSections.find((s) => s.key === currentSection)?.label ?? 'Tableau de bord',
    [visibleSections, currentSection]
  )

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await api.post('/api/auth/logout')
    } catch {
      // la session locale est purgée quoi qu'il arrive
    }
    setSession(null)
    setLoggingOut(false)
    toast({ title: 'Déconnexion réussie', description: 'À bientôt sur la rédaction.' })
    navigate({ name: 'home' })
  }

  if (!sessionLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3" role="status" aria-label="Chargement de la session">
          <Loader2 className="h-8 w-8 animate-spin text-marque" />
          <p className="text-sm text-muted-foreground">Chargement de votre session…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-marque" aria-label="Redirection vers la connexion" />
      </div>
    )
  }

  const renderNav = (onNavigate: () => void) => (
    <nav aria-label="Navigation de l'administration" className="flex flex-col gap-0.5">
      {visibleSections.map((section) => {
        const active = section.key === currentSection
        const badge = section.badgeKey ? badgeCounts?.[section.badgeKey] ?? 0 : 0
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => {
              navigate({ name: 'admin', section: section.key })
              onNavigate()
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'min-h-[44px] text-left',
              active
                ? 'border-l-2 border-marque bg-marque-clair text-marque dark:bg-marque/15'
                : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <section.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{section.label}</span>
            {badge > 0 ? (
              <span className="rounded-full bg-jaune px-2 py-0.5 text-[11px] font-bold text-yellow-950 tabular-nums">
                {badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )

  const renderLogo = () => (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-marque font-black text-white" aria-hidden="true">
        M
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">{session ? 'Média' : 'Média'} — Admin</p>
        <p className="text-[11px] text-muted-foreground">Espace rédaction</p>
      </div>
    </div>
  )

  const content = (() => {
    // Garde côté client : une section hors périmètre du rôle affiche un écran 403
    // (les données restent de toute façon protégées côté serveur).
    if (
      currentSection !== 'dashboard' &&
      currentSection &&
      !visibleSections.some((s) => s.key === currentSection)
    ) {
      return (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-20 text-center">
          <p className="text-6xl font-black text-gradient-marque">403</p>
          <h2 className="text-xl font-bold">Accès refusé</h2>
          <p className="text-sm text-muted-foreground">
            Votre rôle ne permet pas d&apos;accéder à cette section du tableau de bord.
          </p>
          <Button onClick={() => navigate({ name: 'admin' })} className="mt-2 min-h-[44px]">
            Retour au tableau de bord
          </Button>
        </div>
      )
    }
    switch (currentSection) {
      case 'articles':
        return <AdminArticles />
      case 'categories':
        return <AdminCategories />
      case 'fm':
        return <AdminFM />
      case 'tv':
        return <AdminTV />
      case 'comments':
        return <AdminComments />
      case 'flash':
        return <AdminFlash />
      case 'ads':
        return <AdminAds />
      case 'contact':
        return <AdminContact />
      case 'users':
        return <AdminUsers />
      case 'settings':
        return <AdminSettings />
      case 'pages':
        return <AdminPages />
      case 'audit':
        return <AdminAudit />
      case 'backup':
        return <AdminBackup />
      default:
        return <AdminDashboard />
    }
  })()

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* ---- Sidebar fixe (desktop) ---- */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="px-4 py-4">{renderLogo()}</div>
        <div className="scroll-slim flex-1 overflow-y-auto px-2 pb-4">{renderNav(() => {})}</div>
        <div className="border-t px-4 py-3 text-[11px] text-muted-foreground">Tableau de bord d&apos;administration</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---- Topbar ---- */}
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex h-14 items-center gap-2 px-3 md:px-6">
            {/* Menu mobile */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b px-4 py-4 text-left">
                  <SheetTitle asChild>
                    <div>{renderLogo()}</div>
                  </SheetTitle>
                </SheetHeader>
                <div className="scroll-slim max-h-[calc(100vh-5rem)] overflow-y-auto px-2 py-2">{renderNav(() => setMenuOpen(false))}</div>
              </SheetContent>
            </Sheet>

            <h2 className="truncate text-sm font-semibold md:text-base">{activeLabel}</h2>

            <div className="ml-auto flex items-center gap-1.5 md:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ name: 'home' })}
                className="min-h-[36px]"
              >
                <ExternalLink className="mr-0 h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">Voir le site</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted"
                    aria-label="Menu du compte"
                  >
                    <Avatar className="h-8 w-8">
                      {session.avatarUrl ? <AvatarImage src={session.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="bg-marque-clair text-xs font-bold text-marque">
                        {initials(session.firstName, session.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden min-w-0 text-left md:block">
                      <span className="block truncate text-xs font-semibold">
                        {session.firstName} {session.lastName}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABELS[session.role] ?? session.role}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-semibold">
                      {session.firstName} {session.lastName}
                    </p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{session.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rouge focus:text-rouge"
                    disabled={loggingOut}
                    onSelect={() => {
                      void handleLogout()
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* ---- Contenu ---- */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{content}</main>
      </div>
    </div>
  )
}
