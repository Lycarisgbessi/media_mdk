# Plateforme Média — site d'information + FM + TV

Plateforme d'information généraliste (site web, module FM audio, module TV vidéo)
développée selon un cahier des charges v3.0. Interface entièrement en français,
charte graphique noir / rouge, mode sombre, PWA.

## Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- Tailwind CSS 4 + shadcn/ui + Radix + framer-motion + TipTap (éditeur riche)
- **Prisma 6 + PostgreSQL** (hébergé sur [Neon](https://neon.tech))
- État global : Zustand — navigation **SPA mono-route** (tout passe par `/`)
- Auth maison : cookie signé HMAC + scrypt + 2FA

## Démarrage local

```bash
npm install          # génère aussi le client Prisma (postinstall)
npm run db:push      # crée le schéma sur PostgreSQL (via DIRECT_URL)
npm run db:seed      # contenu éditorial de démonstration
npm run dev          # http://localhost:3000
```

Variables d'environnement (fichier `.env`, non commité) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL **via pooler** (`…-pooler…neon.tech…&pgbouncer=true`) — utilisée à l'exécution |
| `DIRECT_URL` | PostgreSQL **connexion directe** (sans `-pooler`) — utilisée par `prisma db push` / `seed` / `migrate` |
| `AUTH_SECRET` | Secret HMAC des cookies de session (≥ 32 caractères, obligatoire en production) |

```bash
# Générer un AUTH_SECRET :
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Comptes de démonstration

Mot de passe commun : `media2026` — code 2FA de démo : `246810`
> ⚠️ À changer impérativement avant toute mise en production réelle.

| E-mail | Rôle |
|---|---|
| `admin@media.fr` | Administrateur |
| `redaction@media.fr` | Rédacteur en chef |
| `journaliste@media.fr` | Journaliste |
| `fm@media.fr` | Producteur audio |
| `tv@media.fr` | Responsable vidéo |
| `moderation@media.fr` | Modérateur |
| `pub@media.fr` | Régie publicité |

## Déploiement (Vercel + Neon)

1. Importer le repo GitHub dans Vercel (framework détecté : Next.js).
2. Variables d'environnement Vercel :
   - `DATABASE_URL` → URL Neon **pooler** + `?sslmode=require&pgbouncer=true`
   - `AUTH_SECRET` → valeur générée (ne jamais réutiliser celle du dev)
3. Le schéma est déjà appliqué sur la base (voir `npm run db:push` si besoin de resynchroniser).

Fonctionnalités : articles avec workflow éditorial et assistant SEO, rubriques arborescentes,
flash info, podcasts (grille d'émissions + lecteur audio global), vidéos et directs YouTube,
modération de commentaires, régie publicitaire (impressions/clics/CTR), newsletter double opt-in,
messagerie de contact, pages statiques, blocs d'accueil réordonnables, journal d'audit,
export de sauvegarde JSON, PWA.
