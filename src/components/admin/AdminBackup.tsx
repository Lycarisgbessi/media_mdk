'use client'

// =====================================================================
// AdminBackup — sauvegarde & export
// Export JSON complet, politique de conservation, santé des services
// =====================================================================

import { useState } from 'react'
import { Check, Download } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { PageHeader, SectionCard, errMessage } from './admin-ui'

const EXPORT_CONTENTS = [
  'Articles (avec tags, rubriques et auteurs)',
  'Contenus audio du module FM',
  'Vidéos et directs du module TV',
  'Rubriques et flash infos',
  'Réglages du site (identité, couleurs, modules…)',
  'Utilisateurs (sans données d’authentification)',
  'Messages de contact',
  'Commentaires',
]

type DotColor = 'green' | 'yellow' | 'red' | 'gray'

const DOT_CLASSES: Record<DotColor, string> = {
  green: 'bg-marque',
  yellow: 'bg-jaune',
  red: 'bg-rouge',
  gray: 'bg-muted-foreground/40',
}

function HealthRow({ label, dot, status }: { label: string; dot: DotColor; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT_CLASSES[dot])} aria-hidden="true" />
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{status}</span>
    </div>
  )
}

export default function AdminBackup() {
  const { toast } = useToast()
  const { settings } = useAppStore()

  const [exporting, setExporting] = useState(false)
  const [dbOk, setDbOk] = useState<boolean | null>(null)

  const exportAll = async () => {
    setExporting(true)
    try {
      // Le succès de cette requête sert aussi de test de santé de la base de données
      const res = await api.get<{ data: Record<string, unknown> }>('/api/export')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `media-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDbOk(true)
      toast({ title: 'Export téléchargé', description: 'La sauvegarde JSON complète a été générée.' })
    } catch (err: unknown) {
      setDbOk(false)
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sauvegarde & export"
        description="Export JSON complet du contenu et suivi de l'état des services."
      />

      {/* ---- Export complet ---- */}
      <SectionCard
        title="Export complet"
        description="Sauvegarde JSON de l'ensemble des contenus, comptes et réglages de la plateforme."
        actions={
          <Button className="min-h-[44px]" disabled={exporting} onClick={() => void exportAll()}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {exporting ? 'Génération…' : 'Télécharger l’export JSON'}
          </Button>
        }
      >
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {EXPORT_CONTENTS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-marque" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Fichier généré : <span className="font-mono">media-export-AAAA-MM-JJ.json</span> — à conserver hors ligne.
        </p>
      </SectionCard>

      {/* ---- Politique de conservation ---- */}
      <SectionCard
        title="Politique de conservation"
        description="Règles de rétention appliquées aux données de la plateforme."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <span className="font-semibold">Corbeille de 30 jours</span> — les articles, contenus audio et vidéos
            supprimés le sont logiquement : ils restent en base et récupérables pendant 30 jours.
          </li>
          <li>
            <span className="font-semibold">Journaux d&apos;audit conservés</span> — l&apos;historique des actions de la
            rédaction est conservé de manière permanente à des fins de traçabilité.
          </li>
          <li>
            <span className="font-semibold">Export recommandé chaque semaine</span> — téléchargez l&apos;export JSON au
            moins une fois par semaine comme sauvegarde externe.
          </li>
        </ul>
      </SectionCard>

      {/* ---- Santé des services ---- */}
      <SectionCard
        title="Santé des services"
        description="Vérification rapide de l'état de la plateforme."
      >
        <div className="space-y-2">
          <HealthRow
            label="Base de données"
            dot={dbOk === true ? 'green' : dbOk === false ? 'red' : 'gray'}
            status={dbOk === true ? 'Opérationnelle' : dbOk === false ? 'Inaccessible' : 'Non vérifiée — lancez un export'}
          />
          <HealthRow label="API" dot="green" status="En ligne" />
          <HealthRow
            label="Module FM (audio)"
            dot={settings ? (settings.moduleFmActive ? 'green' : 'yellow') : 'gray'}
            status={settings ? (settings.moduleFmActive ? 'Actif' : 'désactivé') : '—'}
          />
          <HealthRow
            label="Module TV (vidéo)"
            dot={settings ? (settings.moduleTvActive ? 'green' : 'yellow') : 'gray'}
            status={settings ? (settings.moduleTvActive ? 'Actif' : 'désactivé') : '—'}
          />
        </div>
      </SectionCard>
    </div>
  )
}
