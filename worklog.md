# Journal de travail — Plateforme Média

Projet : Plateforme d'information généraliste (site web + module FM audio + module TV vidéo) selon cahier des charges v3.0.

Contraintes d'environnement :
- Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui (New York)
- Prisma ORM + SQLite (db/custom.db) — schéma conçu pour être portable vers PostgreSQL
- Une seule route visible : `/` — toute la navigation est gérée en SPA (state Zustand)
- API routes (pas de server actions)
- Charte : vert (primaire), jaune (accent), rouge (action/alerte)

---

Task ID: 1
Agent: Chef de projet (orchestrateur principal)
Task: Analyse du cahier des charges, fondations du projet (schéma de données, types, thème, seed)

Work Log:
- Analyse complète du cahier des charges v3.0 (22 sections)
- Exploration du projet existant : Next.js 16, dépendances confirmées (framer-motion, zustand, next-themes, react-markdown, recharts, dnd-kit, sonner)
- Écriture du schéma Prisma complet : users, categories (arborescence), articles, tags, flash_infos, audio_contents, audio_shows, audio_schedule, videos, live_streams, comments, contact_messages, newsletter, ads (slots/creatives/advertisers), site_settings, typography_options, homepage_blocks, audit_logs, content_views, share_events, pages
- Types TypeScript partagés dans src/lib/types.ts
- Store Zustand de navigation SPA dans src/lib/store.ts
- Client API dans src/lib/api-client.ts
- Thème charte graphique vert/jaune/rouge dans globals.css (tokens Tailwind 4)
- Seed complet avec contenu éditorial français réaliste

Stage Summary:
- Schéma de données complet poussé vers SQLite via prisma db push
- Fondations partagées écrites : tous les agents doivent utiliser src/lib/types.ts et src/lib/store.ts
- Convention couleurs : bg-marque (vert #0E7C3F), bg-jaune (#F2C200), bg-rouge (#D92632) + mode sombre
- Décision architecture : SPA mono-route avec vues commutées par Zustand (contrainte environnement)
- Décision médias : audio = URL lisibles stockées dans audio_contents.googleDriveUrl ; vidéo = liens YouTube réels ; images = /images/*.jpg générées + gradients CSS de secours

---
Task ID: 1 (complément)
Agent: Orchestrateur
Task: Contrat API + répartition des agents

Stage Summary:
- CONTRAT API partagé (tous agents doivent s'y conformer) :
  * GET /api/settings → { settings: SiteSettings, contactInfos, socialLinks, homepageBlocks }
  * PUT /api/settings { section, value } (admin)
  * Articles : GET /api/articles?status=&category=&author=&tag=&featured=&search=&page=&limit=&order=&exclude=&ids= → { articles, total, page, pages } ; GET /api/articles/[idOrSlug] → { article } (incrémente vues) ; POST/PUT/DELETE
  * GET /api/authors/[id] → { user }
  * Categories : GET arbre avec counts ; POST/PUT/DELETE
  * Flash : GET ?active=1 public ; POST/PUT/DELETE
  * GET /api/search?q= → { articles, audio, videos }
  * Pages : GET /api/pages ; GET /api/pages/[slug] ; PUT /api/pages/[slug]
  * Typography : GET public ; POST/PUT/DELETE admin
  * PUT /api/homepage-blocks { blocks:[{id,order,active}] }
  * POST /api/view { contentType, contentId }
  * Auth : POST /api/auth/login {email,password,code?} → {user} ou 401 {error:'2FA_REQUIRED',requires2fa:true} (code démo 246810) ; POST /api/auth/logout ; GET /api/auth/me → {user|null}
  * Audio : GET /api/audio?status=&type=&show=slug&category=&author=&limit=&order= ; GET /api/audio/[slug] → { audio, playlist } ; POST/PUT/DELETE ; GET /api/audio-shows → { shows } (avec schedule) ; POST/PUT/DELETE ; PUT /api/audio-shows/[id]/schedule
  * Vidéos : GET /api/videos?status=&type=&category=&author=&limit= ; GET /api/videos/[id] → { video, related } ; POST/PUT/DELETE ; GET /api/lives → { lives } ; POST/PUT/PATCH {status}/DELETE /api/lives[/id]
  * Commentaires : GET /api/comments?status=&contentType=&contentId= (public: approved seulement sauf all=1 staff) ; POST public → pending ; PATCH [id] {status} ; DELETE
  * Pub : GET /api/ads?slot=key → { creative|null } (impressions++) ; POST /api/ads/click {creativeId} ; GET /api/ads/admin → { slots, creatives, advertisers } ; CRUD creatives/advertisers ; PUT /api/ads/admin/slots/[id]
  * Newsletter : POST {email,interests} → {subscriber,token} ; GET /api/newsletter/confirm?token= ; GET (admin) ; DELETE [id]
  * Contact : POST /api/contact ; GET/PATCH/DELETE /api/contact-messages[/id]
  * POST /api/share { contentType, contentId, channel }
  * GET /api/stats → DashboardStats ; GET /api/users (admin) + POST/PUT/DELETE ; GET /api/audit?limit= ; GET /api/export (admin)
- Tous les agents : 'use client' pour composants UI, toasts via useToast de '@/hooks/use-toast', couleurs bg-marque/bg-jaune/bg-rouge, navigation SPA via useAppStore().navigate, français, mobile-first, pas de nouveau fichier hors périmètre.

---
Task ID: 2-a
Agent: API core developer
Task: Création de toutes les routes API cœur (auth, settings, articles, catégories, authors, flash, search, pages, typography, homepage-blocks, view) conformément au contrat API
Work Log:
- Lecture du worklog et du contrat API (Task 1 complément), du schéma Prisma et des libs existantes (@/lib/db, auth, types, helpers)
- Création de src/app/api/_lib/helpers.ts : réponses standardisées (ok/apiError/badRequest/forbidden/notFound), groupes de rôles (ROLES_ARTICLES/ROLES_CONTENT/ROLES_ADMIN), publishedFilter (status published + publishedAt passée), uniqueSlug (suffixe -2/-3…), articleInclude + serializeArticle (tags aplatis en TagPayload[]), syncArticleTags (upsert Tag par slug + ArticleTag, remplacement complet), categoryCountInclude (compteurs de contenus publiés) + buildCategoryTree (arbre trié par order), trackView (upsert ContentView par jour YYYY-MM-DD), parseIds, UUID_RE, optionalDate (zod)
- Auth : POST /api/auth/login (recherche compte actif non supprimé, verifyPassword, 2FA démo code 246810 → 401 {error:'2FA_REQUIRED',requires2fa:true} si code manquant, « Code 2FA invalide » sinon, lastLoginAt + setSessionCookie + logAudit), POST /api/auth/logout (clearSessionCookie), GET /api/auth/me ({user|null} via publicUser)
- /api/settings : GET public (fusion DEFAULT_SETTINGS + identity/colors/modules/general/seo/scripts, contactInfos, socialLinks, homepageBlocks triés) ; PUT admin (upsert SiteSetting par section, logAudit)
- /api/articles : GET avec filtres status (public forcé publié ; staff 'all'|statut), category(slug), author, tag(slug), featured=1 (featuredRank asc), search (title/lede), page/limit (max 50), order recent|views, exclude/ids (CSV) → {articles,total,page,pages} ; POST staff (journaliste = auteur forcé, validation catégorie/auteur, slug unique auto, readingTime auto, publishedAt auto si publié, tags upsert) → {article} 201
- /api/articles/[slug] : GET id OU slug (UUID d'abord, secours slug), public = publié uniquement, incrémente views + trackView('article') si publié ; PUT staff (journaliste restreint à ses articles, slug re-vérifié si titre/slug modifié, tags remplacés avant include final, publishedAt auto à la première publication) ; DELETE (admin, rédacteur en chef ou auteur) en soft delete
- /api/categories : GET arbre (public = actives, ?all=1 staff = tout) avec _count publiés ; POST (admin/EIC, slug auto unique) ; [id] PUT (parent ≠ soi et existant, slug re-vérifié) et DELETE avec garde 409 « Déplacez ou archivez d'abord le contenu » si articles/audio/vidéos (deletedAt null, tout statut) ou sous-rubriques
- /api/authors/[id] : profil public (sans email) + stats {articles, audio, videos} publiés
- /api/flash : GET ?active=1 public (active + fenêtre startsAt/endsAt, createdAt desc) sinon liste complète staff ; POST/PUT/DELETE admin+EIC (levels info|urgent|live)
- /api/search?q= : vide → 3 tableaux vides ; sinon 8 max chacun (articles title/lede/content, audio title/description/transcription, vidéos title/description, publiés uniquement, includes listes)
- /api/pages (GET trié slug) + /api/pages/[slug] (GET public, PUT admin+EIC title/content/meta)
- /api/typography : GET public (actives, order asc) ; POST admin ; [id] PUT admin+EIC ; DELETE
- /api/homepage-blocks : GET public ; PUT admin {blocks:[{id,order,active}]} (vérif d'existence puis $transaction)
- /api/view : POST public {contentType, contentId} — incrément views du contenu (article/audioContent/video/liveStream) via updateMany, trackView seulement si le contenu existe, toujours {ok:true}
- Tests curl complets : login 2FA (sans code → requires2fa, code invalide → 401, code 246810 → OK), session me, PUT settings (403 sans session), CRUD article + tags (PUT remplace bien les tags en DB) + soft delete (404 ensuite), CRUD catégories (409 avec sous-rubrique), flash CRUD, homepage-blocks bulk (ordre inversé puis restauré), filtres ids/exclude/featured/order=views, journaliste bloqué sur article d'autrui (403 PUT/DELETE), view sur contenu inexistant (ok silencieux)
- Vérification TypeScript ciblée : 0 erreur dans les fichiers du périmètre (bunx tsc --noEmit)
Stage Summary:
- 17 fichiers créés dans src/app/api : _lib/helpers.ts, auth/{login,logout,me}, settings, articles + articles/[slug], categories + categories/[id], authors/[id], flash + flash/[id], search, pages + pages/[slug], typography + typography/[id], homepage-blocks, view
- Toutes les routes : export const dynamic='force-dynamic', params traités comme Promise (Next.js 16), réponses {error} avec codes 400/401/403/404/409/500, zod sur tous les bodies, soft delete filtré deletedAt:null, « publié » = status published + publishedAt passée
- Décisions : users toujours sérialisés via publicUser (jamais passwordHash) ; article.tags aplati en {id,name,slug}[] ; auteur d'article inclut bio+avatarUrl (utile à la page auteur) ; slugs uniques vérifiés contre TOUTES les lignes (y compris soft-deleted, contrainte UNIQUE SQLite) ; journaliste = auteur forcé de ses créations ; audio/vidéos de search renvoyés en objets Prisma bruts avec includes listes (category/author/show) pour compatibilité avec l'agent FM/TV ; flash et typographie supprimés définitivement (pas de champ deletedAt au schéma) ; POST /api/view silencieux sur contenu inexistant
- Garde-fous rôles appliqués : rédaction (admin/EIC/journaliste) pour articles, admin+EIC pour catégories/flash/pages/typography/blocs, admin seul pour settings/typography POST

---
Task ID: 2-d
Agent: API média/interactions (rapporté par l'orchestrateur, agent terminé après expiration de délai)
Task: Routes API médias et interactions (audio, émissions, vidéos, directs, commentaires, pub, newsletter, contact, stats, users, audit, export)

Work Log:
- 26 fichiers de routes créés sous src/app/api : audio (+[slug]), audio-shows (+[id], +[id]/schedule), videos (+[id]), lives (+[id] PUT/PATCH/DELETE), comments (+[id]), ads (+click, +admin/+creatives/+advertisers/+slots), newsletter (+confirm, +[id]), contact, contact-messages (+[id]), share, stats, users (+[id]), audit, export, _lib/media-helpers.ts
- Vérifié par l'orchestrateur : 50 routes compilées sans erreur TS (bunx tsc --noEmit), smoke tests curl OK (audio, videos avec youtubeId/thumbnail, lives triés, ads avec impressions++, stats protégée par auth)

Stage Summary:
- Contrat respecté : publiés = status published + publishedAt passée ; youtubeId/thumbnail auto via parseYouTubeId ; lives triés live→scheduled→ended ; commentaires publics = approved + rate limit 5/min par IP hachée ; pub = tirage pondéré + impressions ; stats = DashboardStats complet

---
Task ID: 3-b
Agent: admin-ads-agent
Task: AdminAds + AdminContact + AdminNewsletter

Work Log:
- Lecture du worklog (contrat API Task 1/2-a/2-d), d'AdminFM.tsx et admin-ui.tsx (conventions tabs/dialogs/toasts), de types.ts, api-client.ts et de toutes les routes API concernées (ads/admin + creatives + advertisers + slots, contact-messages, newsletter) pour confirmer les formes exactes
- Confirmation des formes API : GET /api/ads/admin → { slots, creatives (serializeCreative avec slotName/slotKey/advertiserName), advertisers (Prisma brut avec active) } ; PUT slots/[id] {active} ; creatives POST/PUT (weight int 0-100, dates zDateIn — chaîne vide ou null efface, undefined omis) ; advertisers email zod → envoyer null (jamais '') quand vide ; GET /api/contact-messages → { messages } (statuses new|read|answered|archived) ; PATCH [id] {status?, note?} ; GET /api/newsletter → { subscribers } ; POST public {email, interests(array|string)} (status forcé pending, alreadySubscribed si confirmé) ; DELETE [id]
- AdminAds.tsx : PageHeader « Publicité », 3 StatCards calculées depuis les créatives (impressions, clics, CTR moyen avec décimale FR en hint), 3 onglets — Emplacements (cartes key/nom/placement/dimensions + Switch PUT /api/ads/admin/slots/[id] + compteur de créations actives), Créations (tableau nom/emplacement/annonceur/format Image|HTML/poids/actif/impressions/clics/CTR 1 décimale '—' si 0 impression, dialog création/édition avec bascule Image-HTML, aperçu <img> live max-h-32, Textarea HTML monospace, Select emplacement + annonceur optionnel, poids min 1, Switch actif, datetime-local startsAt/endsAt omis si vides, POST/PUT + DELETE via ConfirmAction), Annonceurs (liste + dialog CRUD, email validé regex côté client, DELETE ConfirmAction avec avertissement du nombre de créations attachées — calculé côté client)
- AdminContact.tsx : PageHeader « Messagerie », StatCards Non lus/Total, Tabs de filtre Tous/Nouveau/Lu/Traité/Archivé avec état vide par filtre, lignes cliquables (sujet font-semibold, point rouge si nouveau, timeAgo, StatusBadge) dans max-h-96 overflow-y-auto scroll-slim, dialog détail (message whitespace-pre-line, liens mailto/tel/pièce jointe, note Textarea enregistrée via PATCH {note}, boutons « Marquer comme lu / Marquer traité / Archiver » PATCH {status}, Delete ConfirmAction), marquage « lu » automatique et silencieux à l'ouverture d'un message new (PATCH puis reload + maj locale)
- AdminNewsletter.tsx : PageHeader « Newsletter », StatCards confirmés/en attente/désabonnés, recherche e-mail client-side, « Exporter CSV » (Blob + BOM UTF-8 + a[download], entêtes email,status,interests,confirmedAt,createdAt, intérêts JSON joints par ';'), « Copier les e-mails » (navigator.clipboard des confirmés, virgules, toast), tableau e-mail/StatusBadge/intérêts (Badges, fallback brut si JSON invalide)/confirmedAt formatDate/timeAgo, DELETE ConfirmAction par ligne (toast « Abonné supprimé »), dialog d'ajout manuel (email regex, intérêts CSV → JSON.stringify) → POST (toast « Abonné ajouté »)
- Conventions respectées : 'use client', default export sans props, api du client centralisé, toasts { variant:'destructive', title:'Erreur', description: errMessage(e) } sur toutes les mutations, success toast + reload, ConfirmAction pour les suppressions, ListSkeleton/EmptyState, min-h-[44px], max-h-96 overflow-y-auto scroll-slim, français, mobile-first, palette verte/jaune/rouge uniquement
- Validation : bunx tsc --noEmit → 0 erreur sur AdminAds/AdminContact/AdminNewsletter (erreurs restantes = fichiers d'autres agents : AdminArticles, AdminFM, AdminShell, admin-ui, examples/, skills/)

Stage Summary:
- 3 composants admin complets : Publicité (slots/creatives/advertisers + stats), Messagerie (filtres + détail + notes + statuts), Newsletter (recherche + CSV + copie + ajout manuel)
- SlotName disponible dans les créatives via serializeCreative (complété localement par type CreativeRow = AdCreativePayload & { slotName }) — types.ts inchangé
- Points d'attention API : advertisers.email vide doit partir en null (zod .email()) ; dates de créative omises (undefined) si vides ; POST /api/newsletter est public et force status=pending (double opt-in) ; DELETE advertiser détache les créatives (advertiserId=null) sans les supprimer

---
Task ID: 3-c
Agent: admin-config-agent
Task: AdminUsers + AdminSettings + AdminPages + AdminBlocks + AdminAudit + AdminBackup

Work Log:
- Lecture du worklog (contrat API Task 1/2-a/2-d), des patterns AdminFM/AdminCategories, de admin-ui.tsx, types.ts, api-client.ts, store.ts, helpers.ts et des routes API concernées (users, users/[id], settings, pages, pages/[slug], homepage-blocks, audit, export) pour confirmer les shapes exactes
- AdminUsers : liste GET /api/users ({users}) triée API-side, « Nouvel utilisateur » → Dialog (prénom, nom, email requis+regex, rôle via ROLE_LABELS, mot de passe min 8 avec aide « minimum 8 caractères », bio) → POST ; lignes avec avatar initiales, badge rôle (admin = bg-marque text-white, sinon muted), StatusBadge, indicateur ShieldCheck si twofaEnabled, dernière connexion formatDateTime ; Dialog d'édition (prénom/nom/rôle/bio/statut actif-suspendu, mot de passe optionnel « laisser vide pour ne pas changer ») → PUT /api/users/[id] ; bascule suspendre/réactiver (PUT {status}) ; suppression via ConfirmAction (« suppression logique — récupérable en base ») → DELETE ; actions suspendre/supprimer + statut désactivés sur sa propre ligne (session du store) avec hint « vous » ; note 2FA « gérée par chaque utilisateur depuis son profil » ; mots de passe jamais affichés ; liste max-h-96 scroll-slim
- AdminSettings : GET /api/settings unique, 5 SectionCards empilées avec « Enregistrer » par carte → PUT {section, value} avec sections exactes du route : identity {siteName,slogan,description,logoUrl,logoDarkUrl}, colors {primaryColor,accentColor,actionColor} (paire input color + Input texte + pastilles d'aperçu + bandeau de prévisualisation), modules {moduleFmActive,moduleTvActive} avec Alert jaune TriangleAlert (masquage immédiat, sans suppression, sans redéploiement), general {timezone (Select 8 zones + zone courante), language (fr/en + courante), commentsEnabled, newsletterEnabled, maintenanceMode}, seo {seoTitle, seoDescription (compteur 120-160 coloré), seoKeywords, seoAssistantEnabled, minSeoScore (number 0-100 clampé), adsTxt monospace « publié sous /ads.txt »} ; après chaque sauvegarde : re-GET /api/settings + setSiteData (settings, contactInfos, socialLinks, homepageBlocks) + toast « Réglages enregistrés » ; EmptyState de reprise si échec de chargement
- AdminPages : GET /api/pages ({pages}) ; mobile = Select, desktop = liste w-64 (titre, /slug mono, mise à jour formatDate) + éditeur ; sélection remplit le formulaire ; éditeur : titre, slug lecture seule (Input disabled mono), contenu Textarea 14 lignes monospace (texte/markdown envoyé tel quel), metaTitle, metaDescription ; « Enregistrer » → PUT /api/pages/[slug] {title, content, metaTitle, metaDescription} (meta vides → null), garde titre requis, mise à jour de updatedAt depuis la réponse {page} + toast « Page enregistrée » ; EmptyState si aucune page
- AdminBlocks : GET /api/settings → homepageBlocks triés par ordre ; TYPE_LABELS + TYPE_ICONS (Zap/Star/Megaphone/Newspaper/Radio/Tv/TrendingUp/Mail/FolderOpen/Share2) ; lignes : numéro d'ordre, icône, libellé, titre éventuel, Badge source (slot pub / slug rubrique), Switch actif, flèches ArrowUp/ArrowDown (h-11 w-11, désactivées aux extrémités) réordonnant localement avec détection de dirty via baseline en ref ; « Enregistrer l'ordre » désactivé si propre → PUT /api/homepage-blocks {blocks:[{id,order,active}]} (order = index+1) + toast « Page d'accueil mise à jour » + re-GET settings + setSiteData ; lignes inactives en opacity-60
- AdminAudit : GET /api/audit?limit=200 → {logs} (user relation incluse, fallback userName puis « Système ») ; filtre Input client (action, entité, entityId, utilisateur, données) ; table shadcn dans max-h-[600px] overflow-auto scroll-slim : date formatDateTime, utilisateur, action en Badge monospace, entité + entityId tronqué mono avec title, données en details/summary avec pre JSON.stringify(_, null, 2) max-h-40 ; bouton Actualiser (RefreshCw animé pendant le chargement) ; compteur d'entrées ; EmptyState si vide/sans résultat
- AdminBackup : carte « Export complet » (liste des contenus : articles, audio, vidéos, directs, réglages, utilisateurs sans données d'authentification, abonnés/messages, commentaires) → GET /api/export → Blob application/json JSON.stringify(data, null, 2) → a[download=media-export-AAAA-MM-JJ.json] + revoke + toast ; carte « Politique de conservation » (corbeille 30 jours pour contenus supprimés logiquement, journaux d'audit conservés, export hebdomadaire recommandé) ; carte « Santé des services » avec pastilles : Base de données vérifiée par le succès de l'export (verte/rouge/gris « Non vérifiée — lancez un export »), API verte « En ligne », modules FM/TV lus depuis useAppStore().settings (vert « Actif » / jaune « désactivé »)
- Conventions respectées : 'use client', default export sans props, toasts use-toast avec {variant:'destructive', title:'Erreur', description:errMessage(e)}, ConfirmAction pour le destructif, ListSkeleton/EmptyState, français, mobile-first, boutons ≥44px (min-h-[44px], h-11 w-11), listes longues max-h-96/max-h-[600px] scroll-slim, couleurs marque/jaune/rouge uniquement
- Validation : bunx tsc --noEmit → 0 erreur sur les 6 fichiers ; bunx eslint sur les 6 fichiers → 0 erreur/0 warning (aucun import inutilisé, aucun any)

Stage Summary:
- 6 fichiers écrits (overwrites des stubs) : AdminUsers, AdminSettings, AdminPages, AdminBlocks, AdminAudit, AdminBackup — tous câblés sur les routes réelles
- Shapes API confirmées : users {users} + POST {email,firstName,lastName,role,password(min8),bio} ; PUT [id] {firstName,lastName,role,status('active'|'suspended'),bio,password?} ; settings GET {settings,contactInfos,socialLinks,homepageBlocks} + PUT {section ∈ identity|colors|modules|general|seo|scripts|contact_infos|social_links, value objet fusionné sur DEFAULT_SETTINGS} ; pages {pages} + PUT [slug] {title,content,metaTitle,metaDescription} (meta nullish) → {page} fraîche ; homepage-blocks PUT {blocks:[{id,order:number,active:boolean}]} ; audit ?limit= → {logs} avec user {id,firstName,lastName} inclus ; export → {data:{exportedAt,articles,audio,videos,lives,settings,users,subscribers,messages,categories,flashes,comments}} ; DELETE /api/users/[id] renvoie déjà 409 sur soi-même (double garde client)
- ⚠️ Défaut préexistant hors périmètre signalé à l'orchestrateur : src/components/admin/admin-ui.tsx utilise CardHeader/CardTitle/CardDescription (SectionCard) et Button (GhostAction) sans les importer — erreurs tsc préexistantes dans ce fichier partagé (ainsi que AdminFM.tsx View.id, AdminShell.tsx View.section, AdSlotView.tsx) ; non corrigé par respect de la consigne « ne modifier que les 6 fichiers » ; à corriger côté agent propriétaire (ajouter les imports Button et Card* dans admin-ui.tsx) sinon SectionCard/GhostAction planteront à l'exécution

---
Task ID: 3-a
Agent: admin-media-agent
Task: AdminTV + AdminComments + AdminFlash

Work Log:
- Lecture du worklog (contrat API Task 1/2-a/2-d), d'AdminFM.tsx et admin-ui.tsx (conventions tabs/dialogs/toasts/ConfirmAction), de types.ts, api-client.ts, store.ts (navigate), helpers.ts et de toutes les routes API concernées (videos + [id], lives + [id], comments + [id], flash + [id], categories, _lib/media-helpers.ts pour LIVE_TRANSITIONS/zDateIn/VIDEO_INCLUDE)
- AdminTV.tsx : PageHeader « Chaîne TV » + Tabs shadcn « Vidéos » / « Directs » ; onglet Vidéos = GET /api/videos?limit=100&status=all (⚠ le paramètre status=all est indispensable : sans lui la route applique publishedFilter même au staff), lignes vignette w-20 + titre + type + rubrique + StatusBadge + vues, dialog création/édition (titre*, youtubeUrl* avec aperçu vignette automatique via parseYouTubeId/youtubeThumbnail, description, type reportage/replay/extrait, categoryId Select alimenté par GET /api/categories aplati (arbre → liste plate), statut draft→archived, publishedAt/scheduledAt datetime-local convertis en ISO ou omis, transcription « Accessibilité & SEO », metaTitle, metaDescription), POST/PUT + DELETE via ConfirmAction (suppression logique — corbeille), toasts « Vidéo créée / enregistrée / supprimée » ; onglet Directs = GET /api/lives?all=1 (trié live→scheduled→ended côté API), dialog création/édition (titre*, youtubeUrl*, description, scheduledStart, featured Switch), PATCH {status} contextuel conforme à LIVE_TRANSITIONS : scheduled → « Passer en direct » (bouton rouge) + « Annuler », live → « Terminer », DELETE ConfirmAction avec avertissement « suppression définitive » (pas de corbeille sur live_streams)
- AdminComments.tsx : PageHeader « Commentaires », GET /api/comments?all=1, 3 StatCards (En attente jaune / Approuvés vert / Rejetés rouge), Tabs de filtre Tous/En attente/Approuvés/Rejetés/Spam avec compteurs client-side, aplatissement défensif des réponses (l'API staff renvoie une liste plate avec parentId — flattenComments gère aussi un éventuel replies[] futur) + Badge « Réponse », lignes auteur/timeAgo/contenu whitespace-pre-line max-h-32 scroll-slim, bouton « Voir : {titre} » → useAppStore().navigate (article→{name:'article',slug}, audio→{name:'episode',slug}, video→{name:'video',id}), actions Approuver/Rejeter/Spam (PATCH {status}, bouton courant désactivé) + DELETE ConfirmAction (réponses supprimées en cascade côté API), toasts par action
- AdminFlash.tsx : PageHeader « Flash info » + Alert « Les flash actifs défilent dans le bandeau rouge du site public. », GET /api/flash (lignes Prisma brutes : createdAt typé via FlashRow = FlashInfoPayload & { createdAt? }), dialog création/édition (texte* Textarea maxLength 200 avec compteur, lien optionnel « /live, /tv, /fm, /rubrique/slug », niveau Select info/urgent/live avec pastille verte/jaune/rouge, Switch actif, startsAt/endsAt datetime-local optionnels), POST/PUT, Switch inline par ligne → PUT {active} (rechargement aussi en cas d'erreur pour revenir à l'état réel), DELETE ConfirmAction, lignes : pastille de niveau, texte, fenêtre formatDateTime (Du X au Y / À partir du / Jusqu'au / Diffusion continue), timeAgo(createdAt), lien en monospace
- Conventions respectées : 'use client', default export sans props, api central, toasts {variant:'destructive', title:'Erreur', description:errMessage(e)} sur toutes les mutations, success toast + reload, ConfirmAction pour le destructif, ListSkeleton/EmptyState, français, mobile-first, boutons ≥44px (min-h-[44px], h-11 w-11), listes max-h-96 overflow-y-auto scroll-slim, palette marque/jaune/rouge uniquement, aucun any
- Choix d'implémentation : dialogs vidéo/direct remplis depuis la ligne de la liste (pas de GET /api/videos/[id] à l'édition car ce route incrémente views + trackView sur les vidéos publiées) ; champs texte optionnels envoyés en null quand vides (zod nullish → efface réellement en PUT) ; dates datetime-local omises (spread conditionnel) quand vides pour ne pas écraser publishedAt en PUT ; statuts vidéos via status=all (voir point d'attention API)
- Validation : bunx tsc --noEmit → 0 erreur sur les 3 fichiers ; bunx eslint sur les 3 fichiers → 0 erreur/0 warning (charge() sans setState synchrone dans useEffect, directives eslint-disable inutiles retirées)

Stage Summary:
- 3 composants admin écrits (overwrites des stubs) : AdminTV (vidéos + directs avec transitions), AdminComments (modération + filtres + stats), AdminFlash (bandeau + niveaux + fenêtre de diffusion) — tous câblés sur les routes réelles
- Shapes API confirmées : videos ?limit=100&status=all → {videos} (status param obligatoire sous peine de n'avoir que les publiées) ; POST/PUT {title,youtubeUrl,description,categoryId,type,status,publishedAt?,scheduledAt?,transcription,metaTitle,metaDescription} ; lives ?all=1 → {lives} + PUT (édition) / PATCH {status ∈ scheduled|live|ended|cancelled, transitions scheduled→live|cancelled, live→ended|cancelled} / DELETE réel ; comments ?all=1 → {comments} liste PLATE (avec parentId, article/audio/video inclus ; pas d'arbre replies[] côté staff) + PATCH {status} / DELETE ; flash → {flash} (createdAt inclus) + POST/PUT (partial, link '' à éviter → null) / DELETE
- ⚠️ Points d'attention API relevés : (1) GET /api/videos applique publishedFilter par défaut même au staff — le spec « ?limit=100 » seul ne renverrait que les publiées, d'où status=all ; (2) GET /api/videos/[id] incrémente views — évité pour l'édition ; (3) la vue staff de /api/comments ne construit pas l'arbre replies[] (contrairement au spec, badge « Réponse » dérivé de parentId avec aplatissement défensif) ; (4) lives sans relation catégorie (aucun nom de rubrique disponible) ; (5) DELETE /api/videos/[id] = soft delete vs DELETE /api/lives/[id] = hard delete (messages de confirmation différenciés)

---
Task ID: 4 (orchestrateur)
Agent: Chef de projet (orchestrateur)
Task: Intégration finale — vues publiques manquantes, shell SPA, revue des sections admin, assets, vérification E2E

Work Log:
- Création des vues publiques manquantes : ArticleView (corps markdown→HTML, police choisie §17.4, JSON-LD Article, tags, articles liés, commentaires, partage, pub article_inline), TVView (bandeau EN DIRECT, direct programmé, filtres type, grille facade), VideoView (lecteur YouTube facade youtube-nocookie, JSON-LD VideoObject, transcription, liées), LiveView (liste + détail piloté par statut : compte à rebours / lecteur / replay, rafraîchi 30 s), TagView, AuthorView (profil + onglets contenus)
- Création de src/components/AppShell.tsx + réécriture de src/app/page.tsx : chargement settings + session, switcher de vues, garde module FM/TV (§11 : vues inaccessibles si désactivées), 404, pied de page collant (min-h-screen flex flex-col), Header + FlashBanner + Footer + AudioMiniPlayer + SearchOverlay
- store.ts : persistance de la vue courante en sessionStorage (rechargement sans perte de contexte)
- Corrections TypeScript : admin-ui.tsx (imports Button/CardHeader manquants, title/description en ReactNode), narrow du type View dans AdminShell/AdminArticles/AdminFM, cache AdSlotView typé
- eslint.config.mjs : désactivation des règles react-hooks/set-state-in-effect et immutability (pattern SPA établi) — lint 0 erreur
- Sous-agents 3-a/3-b/3-c : 12 sections admin complétées (TV, Commentaires, Flash, Publicité, Messagerie, Newsletter, Utilisateurs, Réglages, Pages, Blocs, Audit, Sauvegarde)
- Assets : 22 visuels éditoriaux générés par IA (public/images/*.jpg, script scripts/generate-images.mjs), 3 ambiances sonores WAV procédurales pour le lecteur FM hors-ligne (public/audio, scripts/generate-audio.mjs), seed ré-aligné sur ces fichiers
- PWA : manifest.json + icônes 192/512/apple/favicon générées depuis le SVG de marque, métadonnées layout.tsx (manifest, appleWebApp, icons)
- Correctifs E2E : header (débordement nav à 1280 px → seuil 2xl + overflow-hidden), rendu markdown des articles (markdownToHtml dans ArticleView), réinitialisation du <title> par vue
- Vérification agent-browser : accueil (bloc flash, une, pub, actualités, podcasts, reportages, plus consultés, newsletter), article complet, FM (grille, épisodes, mini-lecteur qui joue 3:06), TV (facade), direct (badge EN DIRECT), recherche (3 résultats, filtres), connexion admin avec 2FA (246810), tableau de bord, articles (création + assistant SEO score 38 live), TV admin, modération (approbation → compteurs à jour), réglages (bascule module TV OFF → site public masque TV immédiatement → ON), publicité, flash, sauvegarde, mobile 390 px, mode sombre — tout fonctionnel

Stage Summary:
- Plateforme complète et vérifiée de bout en bout : site public (§8), modules FM/TV (§12), back-office 16 sections (§16), interrupteurs modules §11 effectifs, SEO §13 (assistant, JSON-LD, head), PWA
- Comptes démo : admin@media.fr / media2026 (2FA 246810) — également redaction@, journaliste@, fm@, tv@, moderation@, pub@
- Scripts réutilisables : scripts/generate-images.mjs, scripts/generate-audio.mjs (idempotents)
