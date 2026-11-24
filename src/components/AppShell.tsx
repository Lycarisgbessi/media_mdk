'use client'

// =====================================================================
// AppShell — coquille unique de l'application (route `/` unique) :
// 1) chargement des réglages du site + de la session ;
// 2) navigation SPA par vues (store Zustand) ;
// 3) en-tête / bandeau flash / pied de page collant / mini-lecteur FM ;
// 4) respect des interrupteurs module FM / TV (§11) : les vues des
//    modules désactivés deviennent inaccessibles (écran dédié) ;
// 5) application dynamique des couleurs de marque + bandeau maintenance.
// =====================================================================

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Loader2, Radio, TriangleAlert, Tv } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { DEFAULT_SETTINGS } from '@/lib/types'
import type { ContactInfo, HomepageBlockItem, SiteSettings, SocialLink } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/public/Header'
import { FlashBanner } from '@/components/public/FlashBanner'
import { Footer } from '@/components/public/Footer'
import { AdSlotView, invalidateAdCache } from '@/components/public/AdSlotView'
import type { AdCreativePayload } from '@/lib/types'
import { AudioMiniPlayer } from '@/components/public/AudioMiniPlayer'
import { SearchOverlay } from '@/components/public/SearchOverlay'
import { LoginView } from '@/components/public/LoginView'
import { HomeView } from '@/components/public/HomeView'
import { CategoryView } from '@/components/public/CategoryView'
import { ArticleView } from '@/components/public/ArticleView'
import { FMView } from '@/components/public/FMView'
import { ShowView } from '@/components/public/ShowView'
import { EpisodeView } from '@/components/public/EpisodeView'
import { TVView } from '@/components/public/TVView'
import { VideoView } from '@/components/public/VideoView'
import { LiveView } from '@/components/public/LiveView'
import { SearchView } from '@/components/public/SearchView'
import { AuthorView } from '@/components/public/AuthorView'
import { TagView } from '@/components/public/TagView'
import { ContactView } from '@/components/public/ContactView'
import { PageView } from '@/components/public/PageView'
import AdminShell from '@/components/admin/AdminShell'

// ---------- Bandeau publicitaire collant mobile (slot mobile_sticky) ----------

/**
 * Bandeau 320×50 collant en bas d'écran (mobile uniquement, § Publicité).
 * - invisible tant qu'aucune créative n'est active (hideWhenEmpty) ;
 * - se replace au-dessus du mini-lecteur FM lorsque celui-ci est visible ;
 * - réserve sa hauteur dans le flux pour ne jamais recouvrir le pied de page.
 */
function MobileStickyAd() {
  const playerActive = useAppStore((s) => !!s.playerEpisode)
  const [hasCreative, setHasCreative] = useState(false)
  const handleLoaded = useCallback((creative: AdCreativePayload | null) => setHasCreative(!!creative), [])

  return (
    <>
      <div
        aria-hidden={!hasCreative}
        className="fixed inset-x-0 z-30 transition-transform duration-300 lg:hidden"
        style={{ bottom: 0, transform: playerActive ? 'translateY(-3.25rem)' : 'translateY(0)' }}
      >
        <div
          className="mx-auto w-full max-w-md px-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <AdSlotView
            slot="mobile_sticky"
            hideWhenEmpty
            minHeight={50}
            maxHeight={50}
            className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10"
            onLoaded={handleLoaded}
          />
        </div>
      </div>
      {/* Réserve d'espace : le bandeau fixe ne recouvre jamais le pied de page */}
      {hasCreative && <div aria-hidden="true" className="h-[62px] lg:hidden" />}
    </>
  )
}

// ---------- Écran « module désactivé » (§11) ----------

function ModuleDisabled({ module }: { module: 'fm' | 'tv' }) {
  const navigate = useAppStore((s) => s.navigate)
  const isFm = module === 'fm'
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {isFm ? (
          <Radio className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Tv className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <h1 className="text-2xl font-bold">{isFm ? 'Module FM indisponible' : 'Module TV indisponible'}</h1>
      <p className="text-sm text-muted-foreground">
        {isFm
          ? 'La radio (podcasts, chroniques et reportages audio) est momentanément en pause.'
          : 'La chaîne vidéo (reportages et directs) est momentanément en pause.'}
      </p>
      <Button onClick={() => navigate({ name: 'home' })} className="mt-2 min-h-[44px]">
        Retour à l&apos;accueil
      </Button>
    </div>
  )
}

// ---------- Écran 404 ----------

function NotFoundView() {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-7xl font-black text-gradient-marque">404</p>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">
        La page demandée n&apos;existe pas ou a été déplacée.
      </p>
      <Button onClick={() => navigate({ name: 'home' })} className="mt-2 min-h-[44px]">
        Retour à l&apos;accueil
      </Button>
    </div>
  )
}

// ---------- Sélecteur de vue publique ----------

function PublicContent() {
  const view = useAppStore((s) => s.view)
  const settings = useAppStore((s) => s.settings)

  // Interrupteurs modules : les vues FM/TV deviennent inaccessibles (§11)
  const fmOff = settings?.moduleFmActive === false && ['fm', 'show', 'episode'].includes(view.name)
  const tvOff = settings?.moduleTvActive === false && ['tv', 'video', 'live'].includes(view.name)

  if (fmOff) return <ModuleDisabled module="fm" />
  if (tvOff) return <ModuleDisabled module="tv" />

  switch (view.name) {
    case 'home':
      return <HomeView />
    case 'category':
      return <CategoryView slug={view.slug} />
    case 'article':
      return <ArticleView slug={view.slug} />
    case 'fm':
      return <FMView />
    case 'show':
      return <ShowView slug={view.slug} />
    case 'episode':
      return <EpisodeView slug={view.slug} />
    case 'tv':
      return <TVView />
    case 'video':
      return <VideoView id={view.id} />
    case 'live':
      return <LiveView id={view.id} />
    case 'search':
      return <SearchView q={view.q} />
    case 'author':
      return <AuthorView id={view.id} />
    case 'tag':
      return <TagView slug={view.slug} />
    case 'contact':
      return <ContactView />
    case 'page':
      return <PageView slug={view.slug} />
    default:
      return <NotFoundView />
  }
}

// ---------- Couleurs de marque dynamiques (réglages → CSS) ----------

function shade(hex: string, amount: number): string {
  // Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur hexadécimale
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex
  const num = Number.parseInt(clean, 16)
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)))
  const r = clamp(((num >> 16) & 0xff) + amount * 255)
  const g = clamp(((num >> 8) & 0xff) + amount * 255)
  const b = clamp((num & 0xff) + amount * 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function applyBrandColors(settings: SiteSettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const primary = /^#[0-9a-fA-F]{6}$/.test(settings.primaryColor) ? settings.primaryColor : '#0A0A0A'
  root.style.setProperty('--marque', primary)
  root.style.setProperty('--marque-fonce', shade(primary, -0.12))
  root.style.setProperty('--marque-clair', shade(primary, 0.85))
  if (/^#[0-9a-fA-F]{6}$/.test(settings.accentColor)) {
    root.style.setProperty('--jaune', settings.accentColor)
  }
  if (/^#[0-9a-fA-F]{6}$/.test(settings.actionColor)) {
    root.style.setProperty('--rouge', settings.actionColor)
  }
}

// =====================================================================
// Coquille principale
// =====================================================================

// useLayoutEffect ne s'exécute pas côté serveur : on encapsule pour éviter
// l'avertissement React pendant le rendu serveur du composant client.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function AppShell() {
  const view = useAppStore((s) => s.view)
  const previousViewName = useAppStore((s) => s.previousView?.name ?? null)
  const settings = useAppStore((s) => s.settings)
  const setSiteData = useAppStore((s) => s.setSiteData)
  const setSession = useAppStore((s) => s.setSession)
  const setSessionLoaded = useAppStore((s) => s.setSessionLoaded)
  const restoreView = useAppStore((s) => s.restoreView)

  // Restauration de la dernière vue après rechargement : après hydratation
  // (rendu initial identique au serveur) mais avant la première peinture,
  // pour que l'utilisateur retrouve sa vue sans flash ni écart d'hydratation.
  useIsomorphicLayoutEffect(() => {
    restoreView()
  }, [restoreView])

  // Synchronisation dashboard → site : en quittant l'espace pro (admin ou
  // login) pour revenir sur le site public, on vide le cache des créatives
  // publicitaires — une création ajoutée/modifiée/stopée dans le tableau de
  // bord est donc visible immédiatement, sans rechargement complet.
  useEffect(() => {
    if (previousViewName === 'admin' || previousViewName === 'login') {
      if (view.name !== 'admin' && view.name !== 'login') invalidateAdCache()
    }
  }, [view.name, previousViewName])

  // Réglages du site + session : chargés une seule fois au démarrage.
  // En cas d'échec réseau, on démarre avec les réglages par défaut plutôt
  // que de laisser le site bloqué sur un écran de chargement.
  useEffect(() => {
    let cancelled = false
    api
      .get<{
        settings: SiteSettings
        contactInfos: ContactInfo[]
        socialLinks: SocialLink[]
        homepageBlocks: HomepageBlockItem[]
      }>('/api/settings')
      .then((res) => {
        if (cancelled) return
        setSiteData(res.settings, res.contactInfos ?? [], res.socialLinks ?? [], res.homepageBlocks ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setSiteData(DEFAULT_SETTINGS, [], [], [])
      })
    api
      .get<{ user: import('@/lib/types').UserPayload | null }>('/api/auth/me')
      .then((res) => {
        if (cancelled) return
        setSession(res.user)
        setSessionLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setSession(null)
        setSessionLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [setSiteData, setSession, setSessionLoaded])

  // Application des couleurs de marque personnalisées (réglages > identité).
  // Seulement si l'admin a réellement changé les valeurs par défaut : sinon
  // on conserve les déclinaisons du thème clair/sombre définies en CSS.
  useEffect(() => {
    if (!settings) return
    const customized =
      settings.primaryColor !== '#0A0A0A' ||
      settings.accentColor !== '#BE070F' ||
      settings.actionColor !== '#85060C'
    if (customized) applyBrandColors(settings)
  }, [settings])

  // Titre de l'onglet : réinitialisé à chaque changement de vue ; les vues
  // détaillées (article, vidéo…) le remplacent après chargement de leurs données.
  useEffect(() => {
    const name = settings?.siteName || 'MÉDIA'
    if (view.name === 'article' || view.name === 'video') return
    document.title = `${name} — ${settings?.slogan || "L'information qui compte, en continu"}`
  }, [view, settings])

  // Espace pro (admin / login) : rendu plein écran sans en-tête public
  if (view.name === 'admin') {
    return (
      <>
        <AdminShell />
        {/* Le lecteur audio reste monté : l'écoute continue depuis le back-office */}
        <AudioMiniPlayer />
      </>
    )
  }
  if (view.name === 'login') return <LoginView />
  if (!settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marque shadow-lg shadow-marque/25">
          <span className="text-2xl font-black text-white">M</span>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-marque" aria-label="Chargement du site" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {settings.maintenanceMode && (
        <div className="bg-jaune px-4 py-2 text-center text-sm font-semibold text-black" role="status">
          <TriangleAlert className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Maintenance en cours — certaines fonctionnalités peuvent être indisponibles momentanément.
        </div>
      )}
      <Header />
      <FlashBanner />
      {/* Bandeau publicitaire haut (slot header_banner) — desktop uniquement */}
      <div className="mx-auto hidden max-w-7xl px-4 pt-3 lg:block lg:px-6">
        <AdSlotView slot="header_banner" minHeight={90} />
      </div>
      <main className="flex-1">
        <PublicContent />
      </main>
      <Footer />
      <MobileStickyAd />
      <AudioMiniPlayer />
      <SearchOverlay />
    </div>
  )
}
