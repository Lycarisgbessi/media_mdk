'use client'

// =====================================================================
// Déduplication des vues (côté client) — évite de compter plusieurs fois
// le même contenu pendant une session (lecture + page épisode, re-rendus…)
// =====================================================================

const viewed = new Set<string>()

/**
 * Marque un contenu comme « vu » pour la session.
 * Renvoie true si c'est la première fois (=> incrémenter le compteur),
 * false si la vue a déjà été enregistrée.
 */
export function markViewed(key: string): boolean {
  if (viewed.has(key)) return false
  viewed.add(key)
  return true
}
