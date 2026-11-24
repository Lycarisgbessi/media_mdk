'use client'

// =====================================================================
// AudioMiniPlayer — lecteur audio GLOBAL (unique <audio> de l'application)
// Barre fixe en bas : lecture/pause, file d'attente, progression,
// vitesse, volume — conforme §6.2 (signalement d'un lien indisponible)
// =====================================================================

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, Loader2, Pause, Play, SkipForward, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api-client'
import { formatDuration, drivePlayableUrl } from '@/lib/helpers'
import { markViewed } from '@/lib/viewed'
import { useAppStore } from '@/lib/store'

const RATES = [0.75, 1, 1.25, 1.5, 2]

export function AudioMiniPlayer() {
  const playerEpisode = useAppStore((s) => s.playerEpisode)
  const playerQueue = useAppStore((s) => s.playerQueue)
  const isPlaying = useAppStore((s) => s.isPlaying)
  const togglePlay = useAppStore((s) => s.togglePlay)
  const playNext = useAppStore((s) => s.playNext)
  const stopPlayer = useAppStore((s) => s.stopPlayer)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [loading, setLoading] = useState(false)

  const url = playerEpisode ? drivePlayableUrl(playerEpisode.url, undefined) || playerEpisode.url : ''
  const invalidUrl = !!playerEpisode && !url

  // Changement d'épisode : nouvelle source
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playerEpisode) return
    if (!url) return
    setLoading(true)
    audio.src = url
    audio.load()
    setProgress(0)
    setDuration(playerEpisode.duration || 0)
  }, [url, playerEpisode])

  // Lecture / pause pilotées par le store
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playerEpisode) return
    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying, playerEpisode])

  // Vitesse et volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const handlePlay = () => {
    const ep = useAppStore.getState().playerEpisode
    if (!ep) return
    // Déduplication partagée avec la page épisode (une seule vue / session)
    if (!markViewed(`audio:${ep.id}`)) return
    api.post('/api/view', { contentType: 'audio', contentId: ep.id }).catch(() => {})
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (audio) setProgress(audio.currentTime)
  }

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    setLoading(false)
    if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration)
  }

  const handleError = () => setLoading(false)

  const handleEnded = () => playNext()

  const seek = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const target = ratio * duration
    audio.currentTime = target
    setProgress(target)
  }

  const seekKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return
    if (event.key === 'ArrowRight') {
      audio.currentTime = Math.min(audio.duration || duration, audio.currentTime + 10)
    } else if (event.key === 'ArrowLeft') {
      audio.currentTime = Math.max(0, audio.currentTime - 10)
    }
  }

  return (
    <AnimatePresence>
      {playerEpisode && (
        <motion.div
          key="audio-mini-player"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur"
        >
          <audio
            ref={audioRef}
            preload="metadata"
            onPlay={handlePlay}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
            onEnded={handleEnded}
          />

          {invalidUrl ? (
            // §6.2 — lien audio indisponible : information claire + fermeture
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
              <CloudOff className="h-5 w-5 shrink-0 text-rouge" />
              <p className="flex-1 text-sm font-medium text-rouge">
                Lien audio indisponible — signalé au tableau de bord
              </p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer le lecteur"
                className="h-11 w-11 rounded-full"
                onClick={stopPlayer}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl px-3 py-2 md:px-4">
              {/* Barre de progression cliquable */}
              <div
                role="slider"
                tabIndex={0}
                aria-label="Position de lecture"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration) || 0}
                aria-valuenow={Math.round(progress)}
                onClick={seek}
                onKeyDown={seekKeyboard}
                className="group -mx-1 flex cursor-pointer items-center px-1 py-2"
              >
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-marque transition-[width] duration-150"
                    style={{ width: `${duration > 0 ? Math.min(100, (progress / duration) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Vignette + titres */}
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque">
                  {playerEpisode.coverImageUrl && (
                    <img
                      src={playerEpisode.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">{playerEpisode.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {playerEpisode.showName || 'Écoute en cours'}
                  </p>
                </div>

                {/* Contrôles */}
                <div className="flex items-center gap-1">
                  {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Button
                    size="icon"
                    aria-label={isPlaying ? 'Pause' : 'Lecture'}
                    onClick={() => togglePlay()}
                    className="h-11 w-11 rounded-full bg-marque text-white hover:bg-marque-fonce"
                  >
                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-0.5 fill-current" />}
                  </Button>
                  {playerQueue.length > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Épisode suivant"
                      onClick={playNext}
                      className="h-11 w-11 rounded-full"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {/* Temps */}
                <span className="hidden w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                  {formatDuration(Math.floor(progress))} / {formatDuration(Math.floor(duration || playerEpisode.duration))}
                </span>

                {/* Vitesse */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-11 min-w-[44px] rounded-full px-2 text-xs font-semibold tabular-nums">
                      {rate}×
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-24">
                    {RATES.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => setRate(r)}
                        className={r === rate ? 'bg-accent font-semibold' : ''}
                      >
                        {r}×
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Volume */}
                <div className="hidden items-center gap-2 md:flex">
                  <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Slider
                    value={[volume]}
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label="Volume"
                    onValueChange={(vals) => setVolume(vals[0] ?? 1)}
                    className="w-20"
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Arrêter la lecture"
                  onClick={stopPlayer}
                  className="h-11 w-11 shrink-0 rounded-full"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AudioMiniPlayer
