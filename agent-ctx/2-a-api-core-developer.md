# Task ID: 2-a — API core developer

## Travail réalisé
Routes API cœur créées (contrat API respecté) :
- `src/app/api/_lib/helpers.ts` — helpers partagés : réponses ok/apiError(400/401/403/404/409), rôles (ROLES_ARTICLES=[admin,editor_in_chief,journalist], ROLES_CONTENT=[admin,editor_in_chief], ROLES_ADMIN=[admin]), publishedFilter(), uniqueSlug(), articleInclude+serializeArticle (tags → TagPayload[]), syncArticleTags(), categoryCountInclude()+buildCategoryTree(), trackView() (ContentView par jour), parseIds, UUID_RE, optionalDate (zod).
- Auth : POST /api/auth/login (2FA démo 246810 → `{error:'2FA_REQUIRED',requires2fa:true}` 401 si absent), POST /api/auth/logout, GET /api/auth/me → `{user|null}` (publicUser).
- GET/PUT /api/settings (GET public fusionne DEFAULT_SETTINGS + identity/colors/modules/general/seo/scripts + contactInfos + socialLinks + homepageBlocks ; PUT admin par section).
- GET/POST /api/articles ; GET/PUT/DELETE /api/articles/[slug] (id OU slug ; vues + ContentView sur GET publié ; journaliste limité à ses articles en PUT ; DELETE soft = admin/EIC/auteur ; tags remplacés via `tags:[noms]`).
- GET/POST /api/categories ; PUT/DELETE /api/categories/[id] (arbre + _count publiés ; ?all=1 staff ; DELETE 409 « Déplacez ou archivez d'abord le contenu »).
- GET /api/authors/[id] → `{user:{id,firstName,lastName,role,bio,avatarUrl}, stats:{articles,audio,videos}}` (publiés).
- GET /api/flash (?active=1 public : active + fenêtre de diffusion) ; POST/PUT/DELETE (admin/EIC).
- GET /api/search?q= → `{articles,audio,videos}` (8 max, publiés, includes listes).
- GET /api/pages, GET/PUT /api/pages/[slug] (PUT admin/EIC).
- GET/POST /api/typography (POST admin) ; PUT/DELETE /api/typography/[id] (admin/EIC).
- GET/PUT /api/homepage-blocks (PUT admin, bulk [{id,order,active}] en transaction).
- POST /api/view {contentType,contentId} (incrément views du modèle + ContentView ; silencieux si contenu absent).

## Points d'attention pour les autres agents
- Import des helpers API : `@/app/api/_lib/helpers` (dossier `_lib` non routable). Un `media-helpers.ts` existe aussi dans `_lib` (créé par l'agent FM/TV) — ne pas confondre.
- `params` est une **Promise** dans toutes les routes dynamiques (`const { id } = await ctx.params`).
- Les articles sérialisés ont `tags: TagPayload[]` aplati et `author` avec bio/avatarUrl ; les dates sont en ISO.
- `slug` unique vérifié contre toutes les lignes (soft-deleted comprises) car contrainte UNIQUE SQLite.
- Réponses erreurs : `{ error: string }` (+ champs extra comme `requires2fa`).
- Testé par curl : login 2FA, CRUD article+tags, garde 409 catégories, bulk blocs, filtres listes, droits journalistes. 0 erreur TypeScript sur le périmètre.
