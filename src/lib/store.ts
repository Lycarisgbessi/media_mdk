'use client'

import { create } from 'zustand'
import type { View, AudioContentPayload, SiteSettings, UserPayload, ContactInfo, SocialLink, HomepageBlockItem } from '@/lib/types'
import { drivePlayableUrl } from '@/lib/helpers'

export interface PlayerEpisode {
  id: string
  title: string
  slug: string
  url: string
  showName?: string
  coverImageUrl?: string | null
  duration: number
}

function toPlayerEpisode(ep: AudioContentPayload): PlayerEpisode {
  return {
    id: ep.id,
    title: ep.title,
    slug: ep.slug,
    // Convertit un lien de partage Google Drive en URL jouable par <audio>
    url: drivePlayableUrl(ep.googleDriveUrl, ep.googleDriveFileId),
    showName: ep.show?.name || undefined,
    coverImageUrl: ep.coverImageUrl,
    duration: ep.duration,
  }
}

interface AppState {
  // Navigation SPA
  view: View
  previousView: View | null
  navigate: (v: View) => void
  back: () => void
  restoreView: () => void

  // Recherche
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  // Réglages du site (chargés depuis /api/settings)
  settings: SiteSettings | null
  contactInfos: ContactInfo[]
  socialLinks: SocialLink[]
  homepageBlocks: HomepageBlockItem[]
  setSiteData: (s: SiteSettings, c: ContactInfo[], l: SocialLink[], b: HomepageBlockItem[]) => void

  // Session utilisateur
  session: UserPayload | null
  sessionLoaded: boolean
  setSession: (u: UserPayload | null) => void
  setSessionLoaded: (v: boolean) => void

  // Lecteur audio global (module FM)
  playerEpisode: PlayerEpisode | null
  playerQueue: PlayerEpisode[]
  isPlaying: boolean
  playEpisode: (ep: AudioContentPayload, queue?: AudioContentPayload[]) => void
  playNext: () => void
  togglePlay: (playing?: boolean) => void
  stopPlayer: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Rendu initial identique au rendu serveur ({ name: 'home' }) : la dernière
  // vue visitée est restaurée après hydratation via restoreView() (appelé par
  // AppShell avant la première peinture). Lire sessionStorage pendant le
  // premier rendu provoquerait un écart d'hydratation dès que l'utilisateur
  // recharge la page hors de l'accueil.
  view: { name: 'home' } as View,
  previousView: null,
  restoreView: () => {
    if (typeof window === 'undefined') return
    try {
      const saved = sessionStorage.getItem('media-view')
      if (!saved) return
      const parsed = JSON.parse(saved) as View
      if (parsed && typeof parsed.name === 'string' && parsed.name !== 'home') {
        set({ view: parsed })
      }
    } catch {
      // vue par défaut en cas d'erreur
    }
  },
  navigate: (v) => {
    set({ previousView: get().view, view: v })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      try {
        sessionStorage.setItem('media-view', JSON.stringify(v))
      } catch {
        // stockage indisponible : navigation simple
      }
    }
  },
  back: () => {
    const prev = get().previousView
    if (prev) set({ view: prev, previousView: null })
    else set({ view: { name: 'home' } })
  },

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  settings: null,
  contactInfos: [],
  socialLinks: [],
  homepageBlocks: [],
  setSiteData: (s, c, l, b) => set({ settings: s, contactInfos: c, socialLinks: l, homepageBlocks: b }),

  session: null,
  sessionLoaded: false,
  setSession: (u) => set({ session: u }),
  setSessionLoaded: (v) => set({ sessionLoaded: v }),

  playerEpisode: null,
  playerQueue: [],
  isPlaying: false,
  playEpisode: (ep, queue) =>
    set({
      playerEpisode: toPlayerEpisode(ep),
      playerQueue: queue ? queue.filter((e) => e.id !== ep.id).map(toPlayerEpisode) : [],
      isPlaying: true,
    }),
  playNext: () => {
    const { playerQueue, playerEpisode } = get()
    if (playerQueue.length > 0) {
      const [next, ...rest] = playerQueue
      set({ playerEpisode: next, playerQueue: rest, isPlaying: true })
    } else {
      set({ isPlaying: false })
    }
    void playerEpisode
  },
  togglePlay: (playing) => set({ isPlaying: playing ?? !get().isPlaying }),
  stopPlayer: () => set({ playerEpisode: null, playerQueue: [], isPlaying: false }),
}))
