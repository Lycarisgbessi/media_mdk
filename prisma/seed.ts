// =====================================================================
// Seed — Plateforme Média : contenu de démonstration réaliste
// Exécuter : bun prisma/seed.ts
// =====================================================================

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'
import { ensureAdSlots } from '../scripts/ensure-ad-slots'

const db = new PrismaClient()

const DEMO_PASSWORD = 'media2026'

// Utilitaires de dates
function daysAgo(n: number, hour = 9, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d
}
function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3600 * 1000)
}
function inHours(n: number): Date {
  return new Date(Date.now() + n * 3600 * 1000)
}

async function main() {
  console.log('🌱 Nettoyage de la base...')
  await db.auditLog.deleteMany()
  await db.contentView.deleteMany()
  await db.shareEvent.deleteMany()
  await db.comment.deleteMany()
  await db.adCreative.deleteMany()
  await db.adSlot.deleteMany()
  await db.advertiser.deleteMany()
  await db.articleTag.deleteMany()
  await db.tag.deleteMany()
  await db.audioSchedule.deleteMany()
  await db.audioContent.deleteMany()
  await db.audioShow.deleteMany()
  await db.liveStream.deleteMany()
  await db.video.deleteMany()
  await db.article.deleteMany()
  await db.flashInfo.deleteMany()
  await db.homepageBlock.deleteMany()
  await db.category.deleteMany()
  await db.contactMessage.deleteMany()
  await db.typographyOption.deleteMany()
  await db.siteSetting.deleteMany()
  await db.page.deleteMany()
  await db.user.deleteMany()

  // ------------------------------------------------------------------
  // 1. Utilisateurs (un par rôle)
  // ------------------------------------------------------------------
  console.log('👤 Utilisateurs...')
  const pwd = hashPassword(DEMO_PASSWORD)
  const admin = await db.user.create({
    data: {
      email: 'admin@media.fr', passwordHash: pwd, firstName: 'Amina', lastName: 'Diallo',
      role: 'admin', twofaEnabled: true,
      bio: 'Administratrice de la plateforme.',
      lastLoginAt: hoursAgo(2),
    },
  })
  const chief = await db.user.create({
    data: {
      email: 'redaction@media.fr', passwordHash: pwd, firstName: 'Marc', lastName: 'Lemaire',
      role: 'editor_in_chief', twofaEnabled: true,
      bio: "Rédacteur en chef. 15 ans de presse générale.",
      lastLoginAt: hoursAgo(4),
    },
  })
  const journalist1 = await db.user.create({
    data: {
      email: 'journaliste@media.fr', passwordHash: pwd, firstName: 'Sofia', lastName: 'Benali',
      role: 'journalist',
      bio: "Journaliste politique. Ancienne correspondante parlementaire.",
      lastLoginAt: hoursAgo(20),
    },
  })
  const journalist2 = await db.user.create({
    data: {
      email: 'reporter@media.fr', passwordHash: pwd, firstName: 'Théo', lastName: 'Marchand',
      role: 'journalist',
      bio: "Reporter société et éducation.",
      lastLoginAt: hoursAgo(30),
    },
  })
  const fmProducer = await db.user.create({
    data: {
      email: 'fm@media.fr', passwordHash: pwd, firstName: 'Claire', lastName: 'Vasseur',
      role: 'audio_producer',
      bio: 'Productrice et animatrice radio.',
      lastLoginAt: hoursAgo(6),
    },
  })
  const tvManager = await db.user.create({
    data: {
      email: 'tv@media.fr', passwordHash: pwd, firstName: 'Karim', lastName: 'Ould',
      role: 'video_manager',
      bio: 'Responsable vidéo et directs.',
      lastLoginAt: hoursAgo(8),
    },
  })
  await db.user.create({
    data: { email: 'moderation@media.fr', passwordHash: pwd, firstName: 'Léa', lastName: 'Fournier', role: 'moderator', bio: 'Modératrice des commentaires et messages.' },
  })
  await db.user.create({
    data: { email: 'pub@media.fr', passwordHash: pwd, firstName: 'Yann', lastName: 'Costa', role: 'ad_manager', bio: 'Gestionnaire publicitaire.' },
  })

  // ------------------------------------------------------------------
  // 2. Rubriques et sous-rubriques (arborescence §20)
  // ------------------------------------------------------------------
  console.log('📁 Rubriques...')
  const cat = async (name: string, slug: string, color: string, icon: string, description: string, parentId?: string, order = 0) =>
    db.category.create({
      data: { name, slug, color, icon, description, parentId, order, metaTitle: `${name} — actualités et analyses`, metaDescription: `Toute l'actualité ${name.toLowerCase()} : articles, podcasts et vidéos.` },
    })

  const cActualites = await cat('Actualités', 'actualites', '#0E7C3F', 'Newspaper', "L'essentiel de l'actualité, en continu.", undefined, 0)
  await cat('Actualité générale', 'actualite-generale', '#2E8B57', 'Globe', 'Toute l’actualité générale au fil de la journée.', cActualites.id, 1)
  await cat('Faits divers', 'faits-divers', '#B8860B', 'AlertTriangle', 'Faits divers et sécurité.', cActualites.id, 2)
  await cat('Justice', 'justice', '#8B4513', 'Scale', 'Tribunaux, affaires et procédures.', cActualites.id, 3)
  const cInternational = await cat('International', 'international', '#1F6E8C', 'Earth', 'Le monde en mouvement : diplomacy, conflits, coopération.', undefined, 1)
  const cPolitique = await cat('Politique', 'politique', '#0E7C3F', 'Landmark', 'Gouvernement, parlement, partis et élections.', undefined, 2)
  const cSociete = await cat('Société', 'societe', '#C77D02', 'Users', 'Consommation, famille, genres, religions, transports.', undefined, 3)
  const cEconomie = await cat('Économie', 'economie', '#0B6E4F', 'TrendingUp', 'Entreprises, marchés, emploi et pouvoir d’achat.', undefined, 4)
  const cCulture = await cat('Culture', 'culture', '#A23B72', 'Palette', 'Cinéma, musique, livres, expositions et spectacles.', undefined, 5)
  const cSport = await cat('Sport', 'sport', '#D92632', 'Trophy', 'Tous les sports, tous les résultats.', undefined, 6)
  const cEducation = await cat('Éducation', 'education', '#6A4C93', 'GraduationCap', 'École, lycée, université et pédagogie.', undefined, 7)
  const cSante = await cat('Santé', 'sante', '#2A9D8F', 'HeartPulse', 'Médecine, hôpitaux, prévention et bien-être.', undefined, 8)
  const cTech = await cat('Technologie', 'technologie', '#4361EE', 'Cpu', 'Numérique, IA, innovation et startups.', undefined, 9)
  const cInterviews = await cat('Interviews', 'interviews', '#7A5C00', 'MicVocal', 'Les voix qui font l’actualité.', undefined, 10)
  const cAnalyses = await cat('Analyses et opinions', 'analyses-opinions', '#4A4A4A', 'Brain', 'Décryptages, tribunes et points de vue.', undefined, 11)
  const cDossiers = await cat('Dossiers spéciaux', 'dossiers-speciaux', '#946B2D', 'FolderOpen', 'Thèmes temporaires traités en profondeur.', undefined, 12)
  void cDossiers; void cInternational; void cSante; void cEducation; void cAnalyses; void cInterviews

  // ------------------------------------------------------------------
  // 3. Polices d'affichage (§17.4)
  // ------------------------------------------------------------------
  console.log('🔤 Polices...')
  const fontModerne = await db.typographyOption.create({ data: { name: 'Moderne', cssFamily: 'font-article-moderne', usage: 'corps', order: 1 } })
  const fontClassique = await db.typographyOption.create({ data: { name: 'Classique', cssFamily: 'font-article-classique', usage: 'corps', order: 2 } })
  const fontElegant = await db.typographyOption.create({ data: { name: 'Élégant', cssFamily: 'font-article-elegant', usage: 'corps', order: 3 } })
  const fontDynamique = await db.typographyOption.create({ data: { name: 'Dynamique', cssFamily: 'font-article-dynamique', usage: 'corps', order: 4 } })
  void fontModerne

  // ------------------------------------------------------------------
  // 4. Tags
  // ------------------------------------------------------------------
  console.log('🏷️ Tags...')
  const mkTag = (name: string, slug: string) => db.tag.create({ data: { name, slug } })
  const tags = {
    economie: await mkTag('Économie', 'economie'),
    emploi: await mkTag('Emploi', 'emploi'),
    bourse: await mkTag('Bourse', 'bourse'),
    football: await mkTag('Football', 'football'),
    jo: await mkTag('Jeux olympiques', 'jeux-olympiques'),
    cinema: await mkTag('Cinéma', 'cinema'),
    festival: await mkTag('Festival', 'festival'),
    ia: await mkTag('Intelligence artificielle', 'intelligence-artificielle'),
    numerique: await mkTag('Numérique', 'numerique'),
    hopital: await mkTag('Hôpital', 'hopital'),
    education: await mkTag('Éducation', 'education'),
    reforme: await mkTag('Réforme', 'reforme'),
    parlement: await mkTag('Parlement', 'parlement'),
    union: await mkTag('Union européenne', 'union-europeenne'),
    climat: await mkTag('Climat', 'climat'),
    transports: await mkTag('Transports', 'transports'),
    logement: await mkTag('Logement', 'logement'),
    radio: await mkTag('Radio', 'radio'),
    media: await mkTag('Médias', 'medias'),
    interview: await mkTag('Interview', 'interview'),
  }

  // ------------------------------------------------------------------
  // 5. Articles
  // ------------------------------------------------------------------
  console.log('📰 Articles...')
  type ArticleSeed = {
    title: string; subtitle?: string; slug: string; lede: string; content: string;
    categoryId: string; authorId: string; type?: string;
    isFeatured?: boolean; featuredRank?: number; views: number;
    hours?: number; fontId?: string; tags?: string[];
    cover: string; caption?: string; credit?: string;
    status?: string; scheduledAt?: Date; metaDescription?: string; keywords?: string;
  }

  const mk = (a: ArticleSeed) => a
  const publishedHoursAgo = (h: number) => ({ publishedAt: hoursAgo(h), scheduledAt: null as Date | null })

  const articlesSeed: ArticleSeed[] = [
    mk({
      title: "Budget 2027 : le parlement adopte un pacte de finances resserré après une nuit de tractations",
      subtitle: "Le texte final acte une baisse des dépenses publiques et un effort inédit sur les collectivités",
      slug: "budget-2027-parlement-pacte-finances",
      lede: "Après dix-sept heures de débat et plus de 900 amendements examinés, l'Assemblée a adopté dans la nuit le cadre budgétaire pour 2027. Un compromis resserré qui engage une trajectoire de retour sous les 3 % de déficit d'ici 2029.",
      content: `## Une nuit de négociations jusqu'au bout
L'Assemblée nationale a adopté mardi matin, à 3 h 40, le cadre budgétaire pour 2027 par 312 voix contre 289. Le texte, résultat d'un compromis arraché entre les groupes modérés, prévoit **une baisse de 18 milliards d'euros des dépenses publiques** et un redéploiement de 4 milliards vers l'investissement.

> "Nous avons choisi la responsabilité plutôt que la facilité. Ce pacte engage le pays sur une trajectoire crédible", a déclaré la ministre des Finances au sortir de l'hémicycle.

## Ce que contient le texte final
Le document acte trois orientations majeures :

- Un gel des dépenses de fonctionnement de l'État sur deux ans
- Une réforme de la fiscalité locale avec une dotation nouvelle aux communes rurales
- Un effort ciblé de 2,5 milliards sur l'enseignement supérieur et la recherche

## Une opposition divisée sur la suite
La gauche a dénoncé un "budget d'austérité déguisé", tandis qu'une partie de la droite regrettait l'absence d'allègements plus ambitieux. Les débats sur les recettes, prévus la semaine prochaine, s'annoncent aussi tendus : la question du [financement des collectivités](/article/collectivites-locales-pacte-financement) reste le point sensible du calendrier parlementaire.

Les sénateurs examineront le texte à partir du 12 du mois prochain, avant une commission mixte paritaire attendue en fin de session.`,
      categoryId: cPolitique.id, authorId: journalist1.id,
      isFeatured: true, featuredRank: 0, views: 8412, hours: 3,
      cover: '/images/hero-politique.jpg',
      caption: "Les bancs de l'Assemblée nationale lors du vote du cadre budgétaire.",
      credit: 'Média — Service politique',
      tags: ['parlement', 'reforme'], keywords: 'budget 2027 parlement',
      metaDescription: "Le parlement a adopté le cadre budgétaire 2027 : baisse des dépenses, effort sur les collectivités et trajectoire de déficit. Décryptage d'une nuit de tractations.",
    }),
    mk({
      title: "Marchés : la bourse rebondit de 2,3 % portée par l'énergie et l'industrie",
      slug: "marches-bourse-rebond-energie-industrie",
      lede: "L'indice vedette a effacé ses pertes de la semaine en clôture, porté par les valeurs énergétiques et un plan industriel annoncé dans l'automobile.",
      content: `## Un rebond attendu par les analystes
La place financière a terminé en forte hausse de **2,3 %** ce vendredi, effaçant les pertes accumulées depuis lundi. Les valeurs de l'énergie ont progressé de près de 5 % à la suite de la publication de résultats trimestriels supérieurs aux attentes.

## L'industrie automobile en tête des hausses
Le plan annoncé par le troisième constructeur national — 3 milliards d'euros investis sur les batteries et la sobriété des modèles — a dopé tout le secteur. Les sous-traitants ont gagné entre 3 et 7 %.

> "Le marché avait anticipé le pire sur les marges. Les chiffres montrent au contraire une résistance solide de l'industrie", résume une stratégiste de marché.

## Capacité d'embauche et pouvoir d'achat
L'emploi reste le point de vigilance : dans l'enquête mensuelle, 41 % des industriels déclarent des difficultés de recrutement. Notre dossier sur [l'emploi industriel](/tag/emploi) revient sur cette tension persistante.`,
      categoryId: cEconomie.id, authorId: journalist1.id,
      isFeatured: true, featuredRank: 1, views: 6104, hours: 6,
      cover: '/images/hero-economie.jpg',
      caption: "Les écrans de cotation à l'ouverture des marchés.",
      credit: 'Média — Service économie',
      tags: ['bourse', 'economie'], keywords: 'bourse marchés',
      metaDescription: "La bourse rebondit de 2,3 % portée par l'énergie et un plan industriel automobile de 3 milliards. Analyse des valeurs et perspectives.",
    }),
    mk({
      title: "Ligue des champions : l'équipe nationale s'impose 2-1 en prolongation et file en demi-finale",
      subtitle: "Un but dans les ultimes minutes offre une qualification historique au stade municipal",
      slug: "ligue-champions-qualification-prolongation",
      lede: "Menée au score à la 80e minute, la formation locale a renversé la rencontre en dix minutes de folie. La ville vit une qualification historique pour le dernier carré européen.",
      content: `## Un scénario de légende
C'est le genre de soirée que les supporters raconteront longtemps. Menée 0-1 à la 80e minute, l'équipe a égalisé sur corner à la 86e, avant de marquer le but décisif à la 113e, en prolongation.

> "On ne s'est jamais résignés. Cette équipe a un cœur énorme", a soufflé le capitaine au micro de Média.

## Les chiffres de la rencontre
- 62 % de possession pour les locaux
- 18 tirs tentés, 7 cadrés
- Un arrêt décisif à la 120e sur la ligne

## Vers une demi-finale historique
Le club atteint le dernier carré pour la première fois de son histoire. AuTour du tirage, l'entraîneur assume désormais le statut d'outsider : "Nous n'avons rien à perdre, tout à gagner." Retrouvez l'ambiance du stade dans notre [reportage vidéo](/tv).`,
      categoryId: cSport.id, authorId: journalist2.id,
      isFeatured: true, featuredRank: 2, views: 12420, hours: 9,
      cover: '/images/hero-sport.jpg',
      caption: "La joie des joueurs après le but de la qualification.",
      credit: 'Média — Service des sports',
      tags: ['football'], keywords: 'ligue des champions football',
      metaDescription: "Victoire 2-1 en prolongation : l'équipe nationale file en demi-finale de Ligue des champions après un scénario incroyable. Chiffres et réactions.",
    }),
    mk({
      title: "Intelligence artificielle : le plan national de formation attire 200 000 inscrits en trois mois",
      slug: "intelligence-artificielle-plan-national-formation",
      lede: "Lancée en janvier, la plateforme publique de formations aux outils d'IA dépasse toutes les projections. Les entreprises réclament un volet certifiant.",
      content: `## Un succès inattendu
Trois mois après son lancement, la plateforme nationale de formation à l'intelligence artificielle compte **200 000 inscrits**, selon les chiffres communiqués ce jeudi. Le cap initial d'un an a été franchi cinq fois plus vite que prévu.

## Des parcours pour tous les publics
La plateforme propose quatre parcours :

- Initiation aux usages quotidiens (54 % des inscrits)
- IA appliquée aux métiers de bureau (23 %)
- Module technique et données (14 %)
- Éthique et cadre juridique (9 %)

## Les entreprises en attente d'un volet certifiant
Les organisations patronales demandent l'ajout d'une certification reconnue. "Sans diplôme valorisable sur le marché du travail, la formation restera un geste citoyen", estime le président d'une fédération de la tech. Notre [enquête sur l'IA et l'emploi](/tag/intelligence-artificielle) complète ce décryptage.`,
      categoryId: cTech.id, authorId: journalist2.id,
      views: 4530, hours: 12,
      cover: '/images/hero-tech.jpg',
      caption: "Illustration de réseaux de neurones artificiels.",
      credit: 'Média — Service techno',
      tags: ['ia', 'numerique'], keywords: 'intelligence artificielle formation',
      metaDescription: "200 000 inscrits en trois mois pour le plan national de formation à l'IA. Bilan, parcours proposés et attentes des entreprises.",
    }),
    mk({
      title: "Festival du film : la sélection dévoilée fait la part belle aux premiers longs-métrages",
      slug: "festival-film-selection-premiers-films",
      lede: "Quatre œuvres de réalisateurs débutants figurent dans la compétition officielle, un record pour la 42e édition qui s'ouvrira dans trois semaines.",
      content: `## Une sélection audacieuse
Le délégué général du festival a dévoilé la sélection officielle ce mercredi en fin de matinée : **16 films en compétition**, dont quatre premiers longs-métrages, une première depuis la refonte de l'événement.

## Les temps forts attendus
- Le film d'ouverture, tourné intégralement dans la région
- Une masterclass de deux heures avec un cinéaste primé l'an dernier
- Une nuit du documentaire en plein air, gratuite

## Une édition sous le signe du renouveau
Le jury présidera une édition marquée par la volonté de "donner de l'air aux nouveaux regards". Les billetteries ouvrent ce vendredi à midi ; l'an dernier, 80 % des places s'étaient vendues en quatre jours.`,
      categoryId: cCulture.id, authorId: journalist2.id,
      views: 3210, hours: 18,
      cover: '/images/hero-culture.jpg',
      caption: "La salle du grand théâtre, hôte de la cérémonie d'ouverture.",
      credit: 'Média — Service culture',
      tags: ['cinema', 'festival'], keywords: 'festival film sélection',
      metaDescription: "16 films en compétition dont 4 premiers longs-métrages : la sélection du festival fait le pari du renouveau. Programme et temps forts.",
    }),
    mk({
      title: "Réforme de l'école : ce qui change concrètement pour les enseignants et les familles",
      slug: "reforme-ecole-changements-enseignants-familles",
      lede: "Entrée en vigueur à la rentrée prochaine, la réforme retouche les rythmes scolaires, l'accompagnement et l'évaluation. Le guide pratique de Média.",
      content: `## Trois blocs de changements
La réforme publiée au journal officiel modifie en profondeur l'organisation de la journée scolaire. Voici les points essentiels à retenir pour la rentrée.

## Rythmes : une journée redécoupée
Le socle passe à **26 heures hebdomadaires** avec deux après-midi dédiés au sport et à la culture. Les communes devront ajuster les transports scolaires : plusieurs associations de parents d'élèves s'inquiètent déjà des coûts.

## Accompagnement : des moyens renforcés mais inégaux
- Un dispositif de devoirs faits étendu aux collèges de moins de 300 élèves
- Un financement supplémentaire de 1 200 euros par classe prioritaire
- Le maintien des classes dédoublées en réseau d'éducation

## Évaluation : fin des notes au premier trimestre de sixième
L'évaluation par compétences s'appliquera dès la rentrée, avec un livret numérique unifié. La profession attend les décrets d'application : notre suivi complet de la [réforme de l'éducation](/tag/education) sera mis à jour au fil des publications.`,
      categoryId: cEducation.id, authorId: journalist2.id,
      views: 2890, hours: 26,
      cover: '/images/hero-education.jpg',
      caption: "Une cour d'école au moment de la récréation.",
      credit: 'Média — Service éducation',
      tags: ['education', 'reforme'], keywords: 'réforme école',
      metaDescription: "Rythmes, accompagnement, évaluation : le guide pratique de la réforme de l'école qui entre en vigueur à la rentrée prochaine.",
    }),
    mk({
      title: "Sommet européen : accord sur l'énergie à 27 après une nuit de marche arrière",
      slug: "sommet-europeen-accord-energie-27",
      lede: "Les Vingt-Sept se sont mis d'accord sur un mécanisme commun de solidarité énergétique, après avoir failli quitter la table sans communiqué.",
      content: `## Un accord in extremis
Le sommet s'est achevé à l'aube sur un compromis inattendu : un **mécanisme européen de solidarité énergétique** couvrant les pics de demande et un fonds commun de 12 milliards d'euros pour les réseaux.

## Les points de l'accord
- Une interconnexion renforcée entre les réseaux du Sud et du Nord
- Une clause de révision annuelle plafonnant les contributions
- Un volet "souveraineté industrielle" sur les batteries et l'hydrogène

## La réaction des capitales
Plusieurs gouvernements ont salué "un pas historique", d'autres restent prudents sur la mise en œuvre. La présidence tournante devra présenter une feuille de route d'ici deux mois. Pour comprendre les enjeux, relisez notre [analyse du dossier énergétique](/tag/climat).`,
      categoryId: cInternational.id, authorId: journalist1.id,
      views: 3960, hours: 30,
      cover: '/images/hero-international.jpg',
      caption: "La salle de presse du sommet à l'aube.",
      credit: 'Média — Service international',
      tags: ['union', 'climat'], keywords: 'sommet européen énergie',
      metaDescription: "Accord à 27 sur un mécanisme de solidarité énergétique et un fonds de 12 milliards. Ce que contient le compromis du sommet européen.",
    }),
    mk({
      title: "Hôpitaux : un plan d'urgence de 4 milliards pour les urgences et la pédiatrie",
      slug: "hopitaux-plan-urgence-milliards-urgences-pediatrie",
      lede: "Annoncé face aux tensions de l'hiver, le plan prévoit des créations de postes, des primes de nuit et la réouverture de services fermés faute de personnel.",
      content: `## Un plan attendu depuis des mois
Le ministre de la Santé a présenté un plan d'urgence de **4 milliards d'euros** sur trois ans pour les services d'urgences et de pédiatrie, les plus sous tension de l'hôpital public.

## Les mesures phares
- 8 000 créations de postes soignants sur trois ans
- Une prime de nuit revalorisée de 25 %
- La réouverture conditionnelle de 60 lits de pédiatrie

## Les réactions du terrain
Les fédérations hospitalières accueillent "un signal fort" mais réclament des garanties sur le recrutement effectif. Les urgentistes, eux, rappellent que la médecine de ville reste la clé de la désaturation. Notre [dossier santé](/tag/hopital) suit la mise en œuvre du plan.`,
      categoryId: cSante.id, authorId: journalist2.id,
      views: 3510, hours: 40,
      cover: '/images/hero-sante.jpg',
      caption: "Un service d'urgences en fin de nuit.",
      credit: 'Média — Service santé',
      tags: ['hopital'], keywords: 'hôpital urgences plan',
      metaDescription: "4 milliards sur trois ans pour les urgences et la pédiatrie : postes, primes de nuit, réouvertures. Ce que contient le plan d'urgence hospitalier.",
    }),
    mk({
      title: "Logement : la construction neuve au plus bas depuis dix ans, le marché attend un signal",
      slug: "logement-construction-neuve-plus-bas-dix-ans",
      lede: "Les mises en chantier ont reculé de 11 % sur un an. Professionnels et collectivités demandent une clarification des normes et du crédit.",
      content: `## Un marché en panne sèche
Avec 312 000 mises en chantier sur les douze derniers mois, la construction neuve atteint son plus bas niveau depuis dix ans. La cause : un coût du crédit resté élevé et des normes environnementales en transition.

## Les territoires inégalement touchés
- Les métropoles résistent mieux grâce au logement collectif
- Les zones rurales voient l'offre individuelle s'effondrer
- Le locatif social progresse légèrement, porté par les subventions

## Que attendre des pouvoirs publics ?
Les professionnels réclament un assouplissement ciblé des normes et un plafonnement des frais de dossier. En attendant, la rénovation devient le principal moteur de l'activité : notre [série sur le logement](/tag/logement) explore ces recompositions.`,
      categoryId: cSociete.id, authorId: journalist1.id,
      views: 2180, hours: 50,
      cover: '/images/hero-societe.jpg',
      caption: "Un chantier de logements collectifs à l'arrêt.",
      credit: 'Média — Service société',
      tags: ['logement', 'transports'], keywords: 'logement construction',
      metaDescription: "Mises en chantier en recul de 11 % : la construction neuve au plus bas depuis dix ans. Analyse d'un marché en attente de signaux.",
    }),
    mk({
      title: "Transports : la ligne express ouvre en octobre et reliera la métropole en 22 minutes",
      slug: "transports-ligne-express-ouverture-octobre",
      lede: "Après cinq ans de travaux, la ligne express entrera en service commercial le 14 octobre. Tarifs, fréquence et correspondances : tout ce qu'il faut savoir.",
      content: `## Cinq ans de travaux pour une ligne stratégique
La ligne express, chantier le plus coûteux de la décennie dans la région, sera mise en service le **14 octobre**, ont confirmé les autorités organisatrices. Elle reliera les deux pôles majeurs de la métropole en 22 minutes.

## Un service pensé pour les pendulaires
- Une rame toutes les 6 minutes en heure de pointe
- 14 stations, dont 5 en correspondance avec le réseau existant
- Tarification intégrée au pass mensuel, sans surcoût

## L'effet attendu sur le trafic routier
Les simulations annoncent −9 % de trafic sur l'axe autoroutier parallèle. Les riverains réclament des mesures anti-bruit : un comité de suivi se réunira chaque trimestre. Retrouvez notre [reportage vidéo à bord](/tv) de la première rame d'essai.`,
      categoryId: cSociete.id, authorId: journalist2.id,
      views: 1960, hours: 60,
      cover: '/images/hero-transports.jpg',
      caption: "Une rame d'essai sur le viaduc de la ligne express.",
      credit: 'Média — Service société',
      tags: ['transports'], keywords: 'ligne express transports',
      metaDescription: "Ouverture le 14 octobre : la ligne express reliera la métropole en 22 minutes. Tarifs, fréquence, correspondances et impact routier.",
    }),
    mk({
      title: "Interview : « La radio reste le média le plus intime », confie la productrice d'une émission culte",
      slug: "interview-radio-media-intime-productrice",
      lede: "À la tête d'une émission hebdomadaire écoutée par 800 000 auditeurs, elle raconte vingt ans de radio et l'arrivée du podcast dans les habitudes d'écoute.",
      content: `## Vingt ans derrière le micro
Elle a commencé comme assistante de production "en écoutant plus qu'en parlant". Aujourd'hui, elle dirige une des émissions les plus écoutées de la grille. Entretien.

## « Le podcast n'a pas tué la radio, il l'a prolongée »
> "Quand on a lancé le podcast, on craignait une hémorragie d'audience du direct. C'est l'inverse qui s'est passé : les gens écoutent l'épisode au casque, puis reviennent au direct pour la communauté."

## Une écriture du son à défendre
Pour elle, la continuité sonore — la respiration, le silence — est un savoir-faire à transmettre. "À l'antenne, on ne raconte pas des choses : on les fait entendre." Découvrez ses émissions sur notre [page FM](/fm).`,
      categoryId: cInterviews.id, authorId: chief.id,
      type: 'interview',
      views: 1730, hours: 70,
      cover: '/images/hero-interview.jpg',
      caption: "La productrice dans le studio B, avant l'enregistrement.",
      credit: 'Média — Service culture',
      tags: ['radio', 'media', 'interview'], keywords: 'interview radio podcast',
      metaDescription: "Portrait croisé d'une productrice radio : vingt ans d'antenne, l'arrivée du podcast et l'écriture du son. Entretien exclusif.",
      fontId: 'elegant',
    }),
    mk({
      title: "Analyse : ce que révèle vraiment le retour de l'inflation sur les prix de l'alimentation",
      slug: "analyse-inflation-prix-alimentation-retour",
      lede: "Léger frémissement ou reprise durable ? Trois graphiques et un panier de courses pour comprendre la mécanique des prix.",
      content: `## Un frémissement sous surveillance
L'indice des prix alimentaires a progressé de **0,4 %** sur un mois. Rien de dramatique en apparence. Mais la composition de cette hausse mérite attention.

## Trois moteurs identifiés
- Les céréales, tirées par une récolte mondiale inférieure aux prévisions
- L'énergie de transformation, en hausse saisonnière
- Les coûts d'emballage, revenus au-dessus de leur moyenne 2019

## Que faut-il en déduire ?
Tant que les salaires réels progressent, l'effet ressenti reste limité. Mais pour les foyers modestes, dont le panier est dominé par les produits de base, chaque dixième de point compte. Notre [suivi du pouvoir d'achat](/tag/economie) publie chaque mois le coût d'un panier type.`,
      categoryId: cAnalyses.id, authorId: chief.id,
      type: 'analyse',
      views: 1490, hours: 80,
      cover: '/images/hero-economie-2.jpg',
      caption: "Des rayons de supermarché, miroir des prix.",
      credit: 'Média — Service économie',
      tags: ['economie'], keywords: 'inflation alimentation prix',
      metaDescription: "Inflation alimentaire : +0,4 % en un mois. Analyse en trois graphiques des moteurs des prix et de l'effet sur les foyers modestes.",
      fontId: 'classique',
    }),
    mk({
      title: "Le making-of d'un reportage : trois jours avec les équipes de nuit du port",
      slug: "reportage-equipes-nuit-port-making-of",
      lede: "Notre journaliste a suivi une équipe de dockers de 22 h à 6 h. Récit immersif d'un monde qui ne dort jamais, entre grues, conteneurs et café serré.",
      content: `## 22 heures : la prise de poste
Le vestiaire sent le café et l'huile hydraulique. L'équipe de nuit prend le relais sans à-coups : le port ne s'arrête jamais. Notre journaliste a posé sa caméra et son bloc-notes trois nuits durant.

## La mécanique précise de la nuit
Chaque mouvement est chorégraphié : les conteneurs descendent, les portiques montent, les camions attendent leur tour. **41 000 conteneurs** transitent chaque semaine sur le terminal.

## 6 heures : la fin d'un monde
Au lever du jour, l'équipe rentre chez elle pendant que la ville s'éveille. "On vit à l'envers, mais on fait tourner le pays", résume un docker de 54 ans. Ce reportage est disponible en [version vidéo sur notre page TV](/tv).`,
      categoryId: cDossiers.id, authorId: journalist2.id,
      type: 'reportage_audio' as string,
      views: 1320, hours: 90,
      cover: '/images/hero-port.jpg',
      caption: "Les portiques du terminal au milieu de la nuit.",
      credit: 'Média — Dossiers spéciaux',
      tags: ['transports', 'economie'], keywords: 'reportage port dockers',
      metaDescription: "Trois nuits avec les dockers du port : récit immersif au cœur d'un terminal qui ne dort jamais. Le making-of de notre grand reportage.",
    }),
    mk({
      title: "Faits divers : la police élucide une série de vols commis dans trois départements",
      slug: "faits-divers-police-elucide-serie-vols",
      lede: "Quatre personnes ont été interpellées mercredi matin. Le réseau est soupçonné d'une vingtaine de cambriolages ciblant des commerces.",
      content: `## Une enquête de plusieurs mois
Les interpellations ont eu lieu simultanément dans trois départements, au terme d'une enquête menée par la brigade de répression du banditisme. **Une vingtaine de cambriolages** de commerces sont attribués au groupe.

## Un mode opératoire identifié
Les vols se déroulaient la nuit, en moins de vingt minutes, ciblant des arrière-boutiques. Les enquêteurs ont exploité la vidéosurveillance et les données téléphoniques.

## Une instruction ouverte
Les quatre personnes ont été déférées au parquet. Une information judiciaire est ouverte pour "vols en réunion" ; deux complices présumés restent recherchés.`,
      categoryId: cActualites.id, authorId: journalist1.id,
      views: 2640, hours: 20,
      cover: '/images/hero-police.jpg',
      caption: "Zone de sécurité établie devant le commerce ciblé.",
      credit: 'Média — Service faits divers',
      tags: [], keywords: 'faits divers vols police',
      metaDescription: "Quatre interpellations dans trois départements : la police élucide une série de vols de commerces. Détails de l'enquête.",
    }),
    mk({
      title: "Saisonnalité du tourisme : les stations repensent l'après-saison pour fidéliser",
      slug: "tourisme-stations-apres-saison-fidelisation",
      lede: "Face à l'allongement des vacances hors saison, les stations investissent dans les événements, la marche et le thermalisme pour lisser leur fréquentation.",
      content: `## L'hiver ne suffit plus
Avec des enneigements plus incertains, les stations ont compris qu'elles devaient vendre autre chose que la neige. Résultat : **38 % d'entre elles** ont lancé une offre dite "de quatre saisons".

## Les nouveaux moteurs
- Randonnée et trail avec hébergement en vallée
- Thermalisme et courts séjours bien-être
- Festivals de fin d'été et marchés d'automne

## Une fidélisation qui paie
Les séjours hors saison affichent une durée moyenne plus longue et des dépenses locales mieux réparties. Les offices de tourisme parlent désormais de "saison étendue" plutôt que de morte-saison.`,
      categoryId: cEconomie.id, authorId: journalist2.id,
      views: 1100, hours: 110,
      cover: '/images/hero-societe-2.jpg',
      caption: "Une station de montagne au début de l'automne.",
      credit: 'Média — Service économie',
      tags: ['economie', 'climat'], keywords: 'tourisme stations saison',
      metaDescription: "Les stations de montagne investissent dans les quatre saisons : randonnée, thermalisme, festivals. Comment elles lissent leur fréquentation.",
    }),
    mk({
      title: "Chronique : et si le temps long revenait dans nos agendas ?",
      slug: "chronique-temps-long-agendas",
      lede: "Entre réunions en 30 minutes et notifications immédiates, nos journées se sont atomisées. Plaidoyer pour des plages de travail profondes.",
      content: `## Le temps haché
Nos agendas ressemblent à des gruyères : quinze minutes ici, vingt minutes là. Or la pensée exige du continu. Les études sur l'attention montrent qu'il faut **plus de vingt minutes** pour retrouver une concentration maximale après une interruption.

## Le temps long comme choix collectif
Certaines entreprises testent des matinées sans réunion. Les résultats sont éloquents : moins de réunions, mais des décisions plus rapides.

## Trois habitudes simples
- Bloquer deux plages de deux heures par semaine, hors ligne
- Regrouper les messages à heures fixes
- Assumer la lenteur comme une exigence de qualité

Le temps long n'est pas un luxe : c'est une infrastructure. Il se protège comme tel.`,
      categoryId: cAnalyses.id, authorId: chief.id,
      type: 'chronique',
      views: 980, hours: 130,
      cover: '/images/hero-culture-2.jpg',
      caption: "Un bureau dégagé, symbole du travail profond.",
      credit: 'Média — Analyses',
      tags: [], keywords: 'chronique temps attention',
      metaDescription: "Chronique : nos agendas se sont atomisés. Plaidoyer pour le temps long et la concentration, avec trois habitudes concrètes.",
      fontId: 'elegant',
    }),
    // ---- Statuts particuliers pour le tableau de bord ----
    mk({
      title: "Sécurité routière : les nouveaux radars tourelles déployés sur les axes départementaux",
      slug: "securite-routiere-radars-tourelles-deploiement",
      lede: "Douze nouveaux radars tourelles seront mis en service d'ici la fin du mois sur les axes les plus accidentés du département.",
      content: `## Douze équipements supplémentaires
La direction de la sécurité routière a annoncé le déploiement de douze radars tourelles sur les axes où la vitesse reste le premier facteur d'accidentologie.

## Où et quand
Les emplacements exacts sont publiés en préfecture trente jours avant la mise en service, conformément à la réglementation. Les premières verbalisations interviendront après une période de tolerance d'un mois.`,
      categoryId: cActualites.id, authorId: journalist1.id,
      status: 'review', views: 0, hours: 2,
      cover: '/images/hero-police-2.jpg',
      caption: "Une tourelle de contrôle sur un axe départemental.",
      credit: 'Média — Service faits divers',
    }),
    mk({
      title: "Enquête : les aidants familiaux, un travail invisible en quête de reconnaissance",
      slug: "enquete-aidants-familiaux-travail-invisible",
      lede: "Huit millions de personnes accompagnent au quotidien un proche dépendant. Notre grande enquête sur ce travail invisible et les politiques qui tardent.",
      content: `## Huit millions de personnes
Ils accompagnent un parent, un enfant, un conjoint. Leur engagement vaut des milliards à la collectivité, mais reste largement invisible. Notre enquête part à leur rencontre.

## Le poids du quotidien
Aide à la toilette, courses, gestion des traitements, coordination des professionnels : le rôle d'aidant est un métier que personne n'a choisi mais que beaucoup exercent sans formation ni répit.

## Ce que réclament les associations
- Des congés aidants mieux rémunérés et plus longs
- Un droit au répit effectif, avec des places d'hébergement temporaire
- Une reconnaissance dans le calcul des droits à la retraite`,
      categoryId: cSociete.id, authorId: journalist2.id,
      status: 'draft', views: 0, hours: 1,
      cover: '/images/hero-societe-3.jpg',
      caption: "Illustration d'un accompagnement au quotidien.",
      credit: 'Média — Service société',
    }),
    mk({
      title: "Rentrée culturelle : cinq expositions à ne pas manquer cet automne",
      slug: "rentree-culturelle-cinq-expositions-automne",
      lede: "De la grande rétrospective au centre d'art contemporain, notre sélection d'expositions pour un automne culturel dense.",
      content: `## Une saison généreuse
La rentrée culturelle s'annonce riche : cinq expositions majeures ouvrent leurs portes entre septembre et novembre, dont deux consacrées à des artistes vivants.

## Notre sélection
- La rétrospective d'un peintre majeur du XXe siècle au musée national
- Une exposition immersive sur la lumière au centre d'art
- Les photographies de terrain d'une immense documentariste
- Une scénographie sur les mondes sonores
- Le nouveau cycle du musée d'histoire naturelle`,
      categoryId: cCulture.id, authorId: journalist2.id,
      status: 'scheduled', scheduledAt: inHours(20), views: 0,
      cover: '/images/hero-culture-3.jpg',
      caption: "Une salle d'exposition en cours d'accrochage.",
      credit: 'Média — Service culture',
    }),
  ]

  const fontIdMap: Record<string, string> = {
    elegante: fontElegant.id,
    classique: fontClassique.id,
    dynamique: fontDynamique.id,
  }

  const createdArticles: Record<string, { id: string; title: string; slug: string; views: number }> = {}
  for (const a of articlesSeed) {
    const h = a.hours ?? 24
    const created = await db.article.create({
      data: {
        type: a.type || 'article',
        title: a.title,
        subtitle: a.subtitle ?? null,
        slug: a.slug,
        lede: a.lede,
        content: a.content,
        coverImageUrl: a.cover,
        coverCaption: a.caption ?? null,
        coverCredit: a.credit ?? 'Média',
        categoryId: a.categoryId,
        authorId: a.authorId,
        status: a.status || 'published',
        ...publishedHoursAgo(h),
        scheduledAt: a.scheduledAt ?? null,
        isFeatured: a.isFeatured ?? false,
        featuredRank: a.featuredRank ?? null,
        commentsOpen: true,
        readingTime: Math.max(1, Math.round(a.content.split(/\s+/).length / 200)),
        views: a.views,
        metaTitle: a.title.slice(0, 60),
        metaDescription: a.metaDescription ?? a.lede.slice(0, 155),
        metaKeywords: a.keywords ?? null,
        fontId: a.fontId ? fontIdMap[a.fontId] : null,
        seoScore: a.status === 'published' ? 78 + (a.views % 20) : 55,
        publishedAt: a.status === 'review' || a.status === 'draft' ? null : hoursAgo(h),
      },
    })
    createdArticles[a.slug] = { id: created.id, title: created.title, slug: created.slug, views: created.views }
    if (a.tags) {
      for (const t of a.tags) {
        if (tags[t]) await db.articleTag.create({ data: { articleId: created.id, tagId: tags[t].id } })
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Module FM — émissions, grille, épisodes audio
  // ------------------------------------------------------------------
  console.log('📻 Module FM...')
  const showJournal = await db.audioShow.create({
    data: {
      name: 'Le Journal Parlé', slug: 'le-journal-parle',
      description: "L'essentiel de l'actualité en quinze minutes, du lundi au vendredi. Le journal parlé de Média, lu par la rédaction.",
      coverImageUrl: '/images/radio-journal.jpg', hostNames: 'Claire Vasseur',
      categoryId: cActualites.id, driveFolderUrl: 'https://drive.google.com/drive/folders/demo-journal-parle', order: 1,
    },
  })
  const showMemoire = await db.audioShow.create({
    data: {
      name: 'Mémoire Vive', slug: 'memoire-vive',
      description: 'Une chronique d’archives chaque semaine : un événement, un son d’époque, une histoire qui résonne avec l’actualité.',
      coverImageUrl: '/images/radio-memoire.jpg', hostNames: 'Claire Vasseur',
      categoryId: cCulture.id, driveFolderUrl: 'https://drive.google.com/drive/folders/demo-memoire-vive', order: 2,
    },
  })
  const showGrandFormat = await db.audioShow.create({
    data: {
      name: 'Grand Format', slug: 'grand-format',
      description: 'Les grands reportages audio de la rédaction : immersion, récits et documentaires de quarante minutes.',
      coverImageUrl: '/images/radio-grandformat.jpg', hostNames: 'La rédaction de Média',
      categoryId: cDossiers.id, driveFolderUrl: 'https://drive.google.com/drive/folders/demo-grand-format', order: 3,
    },
  })

  // Grille des programmes (§9.3)
  await db.audioSchedule.createMany({
    data: [
      { showId: showJournal.id, day: 'lundi', time: '07:45', recurrence: 'daily' },
      { showId: showJournal.id, day: 'mardi', time: '07:45', recurrence: 'daily' },
      { showId: showJournal.id, day: 'mercredi', time: '07:45', recurrence: 'daily' },
      { showId: showJournal.id, day: 'jeudi', time: '07:45', recurrence: 'daily' },
      { showId: showJournal.id, day: 'vendredi', time: '07:45', recurrence: 'daily' },
      { showId: showMemoire.id, day: 'samedi', time: '11:00', recurrence: 'weekly' },
      { showId: showGrandFormat.id, day: 'dimanche', time: '18:00', recurrence: 'weekly' },
    ],
  })

  // Fichiers audio de démonstration locaux (public/audio) — le lecteur
  // fonctionne hors-ligne ; en production, ce champ porte une URL Google Drive.
  const AUDIO_JOURNAL = '/audio/demo-journal.wav'
  const AUDIO_MEMOIRE = '/audio/demo-memoire.wav'
  const AUDIO_GRANDFORMAT = '/audio/demo-grandformat.wav'
  const DUR_JOURNAL = 186 // secondes (durée réelle du fichier de démo)
  const DUR_MEMOIRE = 204
  const DUR_GRANDFORMAT = 222

  const audioSeed = [
    {
      type: 'episode', title: 'Le Journal Parlé du jour — édition du matin', slug: 'journal-parle-edition-du-jour',
      description: 'Budget 2027, bourse en rebond et qualification européenne : l’essentiel de l’actualité en quinze minutes, lu par la rédaction de Média.',
      showId: showJournal.id, categoryId: cActualites.id, authorId: fmProducer.id,
      url: AUDIO_JOURNAL, duration: DUR_JOURNAL, season: 1, episodeNumber: 128, views: 4210, hours: 4,
      cover: '/images/radio-journal.jpg',
      transcription: "Au sommaire : le parlement adopte le cadre budgétaire 2027 après une nuit de débat ; les marchés rebondissent de 2,3 % ; et le club se qualifie en demi-finale de Ligue des champions après prolongation.",
    },
    {
      type: 'episode', title: 'Le Journal Parlé — édition de la veille', slug: 'journal-parle-edition-veille',
      description: 'Plan d’urgence hospitalier, rentrée culturelle et marchés : la récapitulation de la veille.',
      showId: showJournal.id, categoryId: cActualites.id, authorId: fmProducer.id,
      url: AUDIO_JOURNAL, duration: DUR_JOURNAL, season: 1, episodeNumber: 127, views: 3180, hours: 28,
      cover: '/images/radio-journal.jpg',
      transcription: "Au sommaire : le plan d’urgence de 4 milliards pour les urgences et la pédiatrie ; la sélection du festival du film ; et le point sur l’emploi industriel.",
    },
    {
      type: 'chronique', title: 'Mémoire Vive — l’été où la radio a changé d’onde', slug: 'memoire-vive-radio-changed-onde',
      description: 'En 1981, l’ouverture des ondes bouleversait le paysage radiophonique. Retour sur une révolution sonore, avec des archives rares.',
      showId: showMemoire.id, categoryId: cCulture.id, authorId: fmProducer.id,
      url: AUDIO_MEMOIRE, duration: DUR_MEMOIRE, views: 2610, hours: 52,
      cover: '/images/radio-memoire.jpg',
      transcription: "Cette semaine : comment la libéralisation des ondes a fait émerger les radios libres, avec des archives sonores des premières années.",
    },
    {
      type: 'chronique', title: 'Mémoire Vive — le silence des stades', slug: 'memoire-vive-silence-stades',
      description: 'Quand les tribunes se sont tues : chronique d’une saison à huis clos et de ses résonances sociales.',
      showId: showMemoire.id, categoryId: cCulture.id, authorId: fmProducer.id,
      url: AUDIO_MEMOIRE, duration: DUR_MEMOIRE, views: 1890, hours: 120,
      cover: '/images/radio-memoire.jpg',
      transcription: "Une saison de football à huis clos, racontée par ceux qui l’ont vécue : joueurs, gardiens et supporteurs.",
    },
    {
      type: 'reportage_audio', title: 'Grand Format — les équipes de nuit du port', slug: 'grand-format-equipes-nuit-port',
      description: 'Immersion de trois nuits avec les dockers du terminal à conteneurs : le port ne dort jamais. Grand reportage sonore de 40 minutes.',
      showId: showGrandFormat.id, categoryId: cDossiers.id, authorId: fmProducer.id,
      url: AUDIO_GRANDFORMAT, duration: DUR_GRANDFORMAT, views: 3420, hours: 90,
      cover: '/images/radio-grandformat.jpg',
      transcription: "De 22 heures à 6 heures : le making-of sonore de notre reportage sur les équipes de nuit du port, entre portiques, conteneurs et café serré.",
    },
    {
      type: 'podcast', title: 'Grand Format — la ligne express, cinq ans de chantier', slug: 'grand-format-ligne-express-chantier',
      description: 'Comment construit-on une ligne express en cinq ans ? Récit sonore d’un chantier titanesque, des premiers pieux à la première rame d’essai.',
      showId: showGrandFormat.id, categoryId: cSociete.id, authorId: fmProducer.id,
      url: AUDIO_GRANDFORMAT, duration: DUR_GRANDFORMAT, views: 2280, hours: 150,
      cover: '/images/radio-grandformat.jpg',
      transcription: "Cinq ans de chantier pour la ligne express : ouvriers, ingénieurs et riverains racontent la plus grande transformation de la métropole.",
    },
    {
      type: 'episode', title: 'Le Journal Parlé — édition spéciale parlement', slug: 'journal-parle-edition-speciale-parlement',
      description: 'Spéciale budget : explications et interviews après l’adoption du cadre budgétaire 2027.',
      showId: showJournal.id, categoryId: cPolitique.id, authorId: fmProducer.id,
      url: AUDIO_JOURNAL, duration: DUR_JOURNAL, season: 1, episodeNumber: 129, views: 0, hours: 1,
      status: 'review',
      cover: '/images/radio-journal.jpg',
      transcription: "Édition spéciale consacrée à l’adoption du cadre budgétaire, avec les explications de notre journaliste politique.",
    },
  ]

  const createdAudio: Record<string, { id: string; title: string; slug: string }> = {}
  for (const ep of audioSeed) {
    const h = ep.hours ?? 48
    const created = await db.audioContent.create({
      data: {
        type: ep.type,
        title: ep.title,
        slug: ep.slug,
        description: ep.description,
        categoryId: ep.categoryId,
        authorId: ep.authorId,
        showId: ep.showId,
        googleDriveFileId: 'demo-file-' + ep.slug,
        googleDriveUrl: ep.url,
        duration: ep.duration,
        coverImageUrl: ep.cover,
        status: ep.status || 'published',
        publishedAt: ep.status ? null : hoursAgo(h),
        scheduledAt: null,
        season: ep.season ?? null,
        episodeNumber: ep.episodeNumber ?? null,
        transcription: ep.transcription ?? null,
        metaTitle: ep.title.slice(0, 60),
        metaDescription: ep.description.slice(0, 155),
        metaKeywords: 'podcast, radio, audio',
        seoScore: 82,
        views: ep.views,
      },
    })
    createdAudio[ep.slug] = { id: created.id, title: created.title, slug: created.slug }
  }

  // ------------------------------------------------------------------
  // 7. Module TV — reportages et directs
  // ------------------------------------------------------------------
  console.log('📺 Module TV...')
  const videosSeed = [
    {
      title: 'Reportage : à bord de la première rame d’essai de la ligne express',
      slugVideo: 'v-rame-essai-ligne-express', youtubeId: 'aqz-KE-bpKQ',
      description: 'Nous avons embarqué à bord de la première rame d’essai de la ligne express, à quelques semaines de l’ouverture. Un voyage entre viaducs et stations neuves.',
      categoryId: cSociete.id, views: 8120, hours: 8, duration: 635,
    },
    {
      title: 'Reportage : dans les coulisses de la qualification européenne',
      slugVideo: 'v-coulisses-qualification-europeenne', youtubeId: 'jNQXAC9IVRw',
      description: 'Du vestiaire à la pelouse : les coulisses de la qualification historique en demi-finale de Ligue des champions.',
      categoryId: cSport.id, views: 15230, hours: 9, duration: 19,
    },
    {
      title: 'Reportage : le port de nuit, grand format vidéo',
      slugVideo: 'v-port-de-nuit', youtubeId: 'M7lc1UVf-VE',
      description: 'Notre caméra a suivi trois nuits durant les équipes du terminal à conteneurs. Un grand format immersif au cœur du commerce mondial.',
      categoryId: cDossiers.id, views: 5240, hours: 72, duration: 3672,
    },
    {
      title: 'Reportage : le plan d’urgence hospitalier expliqué en images',
      slugVideo: 'v-plan-hospitalier-images', youtubeId: '9bZkp7q19f0',
      description: 'Créations de postes, primes de nuit, réouvertures : ce que change concrètement le plan d’urgence de 4 milliards pour les hôpitaux.',
      categoryId: cSante.id, views: 3410, hours: 38, duration: 253,
    },
    {
      title: 'Replay : la conférence de presse budgétaire en intégralité',
      slugVideo: 'v-replay-conference-budget', youtubeId: 'kJQP7kiw5Fk',
      description: 'Revivez l’intégralité de la conférence de presse tenue à l’issue de l’adoption du cadre budgétaire 2027.',
      categoryId: cPolitique.id, views: 4620, hours: 30, duration: 3245, type: 'replay',
    },
    {
      title: 'Extrait : le but de la qualification en prolongation',
      slugVideo: 'v-extrait-but-qualification', youtubeId: 'dQw4w9WgXcQ',
      description: 'Le moment historique : le but décisif à la 113e minute qui envoie le club en demi-finale européenne.',
      categoryId: cSport.id, views: 28140, hours: 9, duration: 61, type: 'extrait',
    },
    {
      title: 'Reportage : le festival du film dévoile sa sélection',
      slugVideo: 'v-festival-selection', youtubeId: 'e-ORhEE9VVg',
      description: 'Quatre premiers longs-métrages en compétition : ce que révèle la sélection officielle de la 42e édition du festival.',
      categoryId: cCulture.id, views: 2110, hours: 16, duration: 236,
    },
    {
      title: 'Reportage : l’IA dans les classes, premier trimestre d’expérimentation',
      slugVideo: 'v-ia-classes-experimentation', youtubeId: 'ScMzIvxBSi4',
      description: 'Dans trois collèges pilotes, les outils d’IA entrent en classe. Premier bilan d’un trimestre d’expérimentation.',
      categoryId: cTech.id, views: 3020, hours: 55, duration: 412,
    },
  ]

  const createdVideos: Record<string, { id: string; title: string }> = {}
  for (const v of videosSeed) {
    const created = await db.video.create({
      data: {
        title: v.title,
        youtubeUrl: v.slugVideo === 'v-rame-essai-ligne-express' ? `https://youtu.be/${v.youtubeId}` : `https://www.youtube.com/watch?v=${v.youtubeId}`,
        youtubeId: v.youtubeId,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`,
        duration: v.duration ?? null,
        description: v.description,
        type: v.type || 'reportage',
        categoryId: v.categoryId,
        authorId: tvManager.id,
        status: 'published',
        publishedAt: hoursAgo(v.hours),
        order: 0,
        metaTitle: v.title.slice(0, 60),
        metaDescription: v.description.slice(0, 155),
        seoScore: 80,
        views: v.views,
      },
    })
    createdVideos[v.slugVideo] = { id: created.id, title: created.title }
  }

  // Directs (§10.3)
  await db.liveStream.create({
    data: {
      title: 'DIRECT — Conseil des ministres : déclarations du gouvernement',
      description: 'Suivez en direct les déclarations à l’issue du conseil des ministres, avec l’analyse de notre rédaction politique.',
      youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', youtubeId: 'M7lc1UVf-VE',
      thumbnailUrl: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
      status: 'live', scheduledStart: hoursAgo(1), actualStart: hoursAgo(1),
      categoryId: cPolitique.id, featured: true, views: 9420,
    },
  })
  await db.liveStream.create({
    data: {
      title: 'DIRECT — Match de demi-finale : avant-match et réactions',
      description: 'Émission spéciale autour de la demi-finale européenne : plateau, invités et réactions après le match.',
      youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', youtubeId: 'jNQXAC9IVRw',
      thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
      status: 'scheduled', scheduledStart: inHours(26),
      categoryId: cSport.id, featured: false, views: 0,
    },
  })
  await db.liveStream.create({
    data: {
      title: 'DIRECT — Grand entretien avec la ministre de la Santé',
      description: 'Un heure d’entretien sans filtre sur le plan d’urgence hospitalier et l’avenir de l’hôpital public.',
      youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0', youtubeId: '9bZkp7q19f0',
      thumbnailUrl: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg',
      status: 'ended', scheduledStart: daysAgo(3, 20), actualStart: daysAgo(3, 20, 5), actualEnd: daysAgo(3, 21, 4),
      categoryId: cSante.id, featured: false, views: 12400,
      replayVideoId: createdVideos['v-plan-hospitalier-images']?.id ?? null,
    },
  })

  // ------------------------------------------------------------------
  // 8. Flash infos
  // ------------------------------------------------------------------
  console.log('⚡ Flash infos...')
  await db.flashInfo.createMany({
    data: [
      { text: 'Budget 2027 : le cadre budgétaire adopté à l’aube par 312 voix contre 289', level: 'info', active: true, startsAt: hoursAgo(3) },
      { text: 'Ligue des champions : demi-finale atteinte après prolongation — réactions en direct', level: 'live', active: true, startsAt: hoursAgo(2), link: '/live' },
      { text: 'Météo : vigilance vent fort levée sur le littoral à 18 h', level: 'info', active: true, startsAt: hoursAgo(8) },
      { text: 'Ligne express : ouverture commerciale confirmée le 14 octobre', level: 'info', active: true, startsAt: hoursAgo(26) },
    ],
  })

  // ------------------------------------------------------------------
  // 9. Blocs de la page d'accueil (§8.2)
  // ------------------------------------------------------------------
  console.log('🏠 Blocs accueil...')
  const homeBlocks = [
    { type: 'flash', title: 'Flash info', order: 1 },
    { type: 'featured', title: 'À la une', order: 2 },
    { type: 'ads', title: 'Publicité', source: 'home_top', order: 3 },
    { type: 'latest', title: 'Dernières actualités', order: 4 },
    { type: 'fm', title: 'Derniers podcasts', order: 5 },
    { type: 'tv', title: 'Derniers reportages', order: 6 },
    { type: 'most_read', title: 'Les plus consultés', order: 7 },
  ]
  await db.homepageBlock.createMany({ data: homeBlocks })

  // ------------------------------------------------------------------
  // 10. Publicité
  // ------------------------------------------------------------------
  console.log('📣 Publicité...')
  // Tous les emplacements publicitaires (12) sont créés via le module
  // partagé scripts/ensure-ad-slots.ts — mêmes clés et mêmes noms que le
  // script d'idempotence, pour que le site puisse y faire référence.
  const { slotsByKey: adSlotByKey } = await ensureAdSlots(db)
  const slotHeader = adSlotByKey['header_banner']
  const slotHomeTop = adSlotByKey['home_top']
  const slotSidebar = adSlotByKey['sidebar']

  const adv1 = await db.advertiser.create({ data: { name: 'Orbis Assurances', contactName: 'Hélène Rouch', email: 'h.rouch@orbis-demo.fr', phone: '+000 000 000' } })
  const adv2 = await db.advertiser.create({ data: { name: 'Café Volta', contactName: 'Samir Bennani', email: 's.bennani@cafevolta-demo.fr' } })

  await db.adCreative.createMany({
    data: [
      { slotId: slotHeader.id, advertiserId: adv1.id, name: 'Orbis — automne (image)', imageUrl: '/ads/orbis-banner.svg', linkUrl: '#', weight: 2, active: true, startsAt: daysAgo(5), endsAt: inHours(24 * 40), impressions: 18400, clicks: 214 },
      { slotId: slotHomeTop.id, advertiserId: adv2.id, name: 'Café Volta — nouvelle gamme', imageUrl: '/ads/volta-home.svg', linkUrl: '#', weight: 1, active: true, startsAt: daysAgo(3), endsAt: inHours(24 * 20), impressions: 9800, clicks: 96 },
      { slotId: slotSidebar.id, advertiserId: adv1.id, name: 'Orbis — encadré latéral', imageUrl: '/ads/orbis-sidebar.svg', linkUrl: '#', weight: 1, active: true, startsAt: daysAgo(5), endsAt: inHours(24 * 40), impressions: 7200, clicks: 58 },
    ],
  })

  // ------------------------------------------------------------------
  // 11. Commentaires
  // ------------------------------------------------------------------
  console.log('💬 Commentaires...')
  const aBudget = createdArticles['budget-2027-parlement-pacte-finances'].id
  const aSport = createdArticles['ligue-champions-qualification-prolongation'].id
  const aTech = createdArticles['intelligence-artificielle-plan-national-formation'].id
  await db.comment.createMany({
    data: [
      { articleId: aBudget, authorName: 'Jean-Michel R.', authorEmail: 'jm.roux@example.fr', content: 'Enfin un décryptage clair sur ce pacte. Merci pour le détail des mesures sur les collectivités.', status: 'approved', createdAt: hoursAgo(20) },
      { articleId: aBudget, authorName: 'Nadia B.', authorEmail: 'nadia.b@example.fr', content: 'Est-ce que vous publierez le détail par ministère ? Ce serait très utile.', status: 'approved', createdAt: hoursAgo(14) },
      { articleId: aSport, authorName: 'Kevin D.', authorEmail: 'kevin.d@example.fr', content: 'Quelle soirée ! Merci pour le reportage dans les coulisses.', status: 'approved', createdAt: hoursAgo(6) },
      { articleId: aBudget, authorName: 'Anonyme', authorEmail: 'anon@example.fr', content: 'Article à lire avant de commenter, il me semble que le chiffre cité est faux.', status: 'pending', createdAt: hoursAgo(2) },
      { articleId: aTech, authorName: 'Formateur Tech', authorEmail: 'formateur@example.fr', content: 'La plateforme est excellente, mais le module certifiant manque vraiment. Publicité gratuite : allez-y !', status: 'pending', createdAt: hoursAgo(1) },
      { articleId: aSport, authorName: 'SupporterRival', authorEmail: 'rival@example.fr', content: 'SPAM SPAM cliquez ici pour des maillots pas chers', status: 'spam', reports: 3, createdAt: hoursAgo(3) },
    ],
  })

  // ------------------------------------------------------------------
  // 12. Contact et pages
  // ------------------------------------------------------------------
  console.log('✉️ Contact & pages...')
  await db.contactMessage.createMany({
    data: [
      { name: 'Émilie Grand', email: 'emilie.grand@example.fr', phone: '+000 000 001', subject: 'Proposition de partenariat', message: 'Bonjour, notre entreprise souhaite sponsoriser votre émission Grand Format. Pouvons-nous échanger ?', status: 'new', createdAt: hoursAgo(5) },
      { name: 'Louis Perret', email: 'louis.perret@example.fr', subject: 'Droit de réponse', message: 'Bonjour, je souhaite exercer un droit de réponse concernant l’article sur la sécurité routière.', status: 'read', createdAt: hoursAgo(26), note: 'À transmettre au rédacteur en chef.' },
      { name: 'Mairie de la Vallée', email: 'presse@mairie-vallee.example.fr', subject: 'Accréditation presse', message: 'Nous souhaitons accréditer deux journalistes pour l’inauguration de la ligne express.', status: 'answered', createdAt: daysAgo(4, 11), note: 'Accréditation envoyée le lendemain.' },
    ],
  })

  console.log('📄 Pages...')
  await db.page.createMany({
    data: [
      {
        slug: 'a-propos', title: 'À propos de Média',
        metaTitle: 'À propos', metaDescription: 'Qui sommes-nous ? La mission, l’équipe et la charte éditoriale de Média.',
        content: `<h2>Notre mission</h2>
<p><strong>Média</strong> est une plateforme d’information généraliste indépendante. Notre mission : informer sans bruit, avec rigueur et clarté, sur tous les supports — écrit, audio et vidéo.</p>
<h2>Notre équipe</h2>
<p>La rédaction réunit des journalistes de la politique, de l’économie, de la société, de la culture et du sport, appuyés par une équipe audio (FM) et une équipe vidéo (TV).</p>
<h2>Notre charte éditoriale</h2>
<p>Nos engagements : vérifier avant de publier, distinguer l’information du commentaire, citer nos sources, corriger nos erreurs publiquement et respecter les personnes dont nous parlons.</p>
<h2>Nous écrire</h2>
<p>La rédaction peut être contactée via notre <a href="#contact">page contact</a>. Un droit de réponse est garanti à toute personne mise en cause.</p>`,
      },
      {
        slug: 'mentions-legales', title: 'Mentions légales',
        metaTitle: 'Mentions légales', metaDescription: 'Mentions légales du média : éditeur, hébergement, propriété intellectuelle.',
        content: `<h2>Éditeur</h2><p>Les informations de l’éditeur (dénomination, forme juridique, siège, directeur de la publication) seront renseignées une fois l’identité du média définie.</p>
<h2>Hébergement</h2><p>Le site est hébergé sur une infrastructure cloud. Les coordonnées de l’hébergeur seront complétées à la mise en production.</p>
<h2>Propriété intellectuelle</h2><p>L’ensemble des contenus (textes, sons, vidéos, images) est protégé. Toute reproduction sans autorisation est interdite.</p>`,
      },
      {
        slug: 'confidentialite', title: 'Politique de confidentialité',
        metaTitle: 'Confidentialité', metaDescription: 'Protection des données personnelles : finalités, durées, droits des utilisateurs.',
        content: `<h2>Données collectées</h2><p>Le site collecte les données strictement nécessaires : adresse e-mail (newsletter), nom et e-mail (commentaires, contact). Les adresses IP sont hachées.</p>
<h2>Finalités</h2><p>Répondre aux messages, publier les commentaires après modération, envoyer la newsletter si vous y avez consenti.</p>
<h2>Vos droits</h2><p>Accès, rectification, suppression : écrivez-nous via la page contact. Les illustrations des fichiers audio et vidéo sont hébergées par des services tiers (Google, YouTube) soumis à leurs propres politiques.</p>`,
      },
      {
        slug: 'cgu', title: 'Conditions générales d’utilisation',
        metaTitle: 'CGU', metaDescription: 'Conditions générales d’utilisation du site et des modules FM et TV.',
        content: `<h2>Objet</h2><p>Les présentes conditions régissent l’accès au site et à ses contenus écrits, audio (FM) et vidéo (TV).</p>
<h2>Commentaires</h2><p>Les commentaires sont modérés avant publication. Tout contenu illicite, injurieux ou spam est supprimé.</p>
<h2>Responsabilité</h2><p>Les contenus audio sont hébergés par des services tiers (Google Drive) et les vidéos par YouTube. La disponibilité de ces services est sous la responsabilité de leurs éditeurs.</p>`,
      },
      {
        slug: 'moderation', title: 'Charte de modération',
        metaTitle: 'Charte de modération', metaDescription: 'Règles de publication des commentaires et de modération.',
        content: `<h2>Esprit des débats</h2><p>Les commentaires visent à enrichir l’information. Le désaccord est bienvenu, la mauvaise foi non.</p>
<h2>Sont supprimés</h2><p>Insultes, discriminations, appels à la haine, informations personnelles, liens commerciaux, spam et contenus hors-sujet répétés.</p>
<h2>Modération</h2><p>Les commentaires sont vérifiés avant publication par l’équipe de modération, généralement sous 24 h. Vous pouvez signaler un commentaire à tout moment.</p>`,
      },
    ],
  })

  // ------------------------------------------------------------------
  // 13. Réglages du site (§16.6 / §16.14) — identité volontairement neutre
  // ------------------------------------------------------------------
  console.log('⚙️ Réglages...')
  const settings: Record<string, unknown> = {
    identity: {
      siteName: 'MÉDIA',
      slogan: "L'information qui compte, en continu",
      description: "Plateforme d'information généraliste : articles, podcasts (FM) et reportages vidéo (TV).",
      logoUrl: '',
      logoDarkUrl: '',
    },
    colors: { primaryColor: '#0E7C3F', accentColor: '#F2C200', actionColor: '#D92632' },
    modules: { moduleFmActive: true, moduleTvActive: true },
    general: {
      timezone: 'Atlantic/Reykjavik', language: 'fr',
      commentsEnabled: true,
      maintenanceMode: false, dataSavingMode: false,
    },
    seo: {
      seoTitle: 'MÉDIA — L’information qui compte, en continu',
      seoDescription: 'Toute l’actualité générale, politique, économique, culturelle et sportive, en articles, podcasts et vidéos.',
      seoKeywords: 'actualités, information, podcast, radio, vidéo, reportages',
      minSeoScore: 0, seoAssistantEnabled: true, aiAssistantEnabled: true,
    },
    scripts: { analyticsScript: '', adsTxt: '' },
    contact_infos: [
      { id: 'ci1', label: 'Rédaction', value: 'redaction@media.fr', type: 'email' },
      { id: 'ci2', label: 'Standard', value: '+00 000 000 000', type: 'phone' },
      { id: 'ci3', label: 'Adresse', value: 'À renseigner une fois l’identité définie', type: 'address' },
    ],
    social_links: [
      { id: 'sl1', platform: 'X', url: 'https://x.com/', active: true },
      { id: 'sl2', platform: 'Facebook', url: 'https://facebook.com/', active: true },
      { id: 'sl3', platform: 'LinkedIn', url: 'https://linkedin.com/', active: true },
      { id: 'sl4', platform: 'YouTube', url: 'https://youtube.com/', active: true },
    ],
    ads_settings: { adsTxt: '', thirdPartyEnabled: false },
  }
  for (const [key, value] of Object.entries(settings)) {
    await db.siteSetting.create({ data: { key, value: JSON.stringify(value) } })
  }

  // ------------------------------------------------------------------
  // 14. Vues agrégées (statistiques) + journal d'audit
  // ------------------------------------------------------------------
  console.log('📊 Statistiques...')
  const contentIds = Object.values(createdArticles).slice(0, 8)
  for (let d = 13; d >= 0; d--) {
    const day = daysAgo(d)
    const dayStr = day.toISOString().slice(0, 10)
    for (const [i, art] of contentIds.entries()) {
      const base = 40 + ((i * 17 + d * 13) % 60)
      await db.contentView.create({
        data: { contentType: 'article', contentId: art.id, day: dayStr, count: base + (13 - d) * (i === 0 ? 4 : 1) },
      })
    }
  }

  await db.auditLog.createMany({
    data: [
      { userId: chief.id, userName: 'Marc Lemaire', action: 'publish', entity: 'article', entityId: createdArticles['budget-2027-parlement-pacte-finances'].id, createdAt: hoursAgo(3) },
      { userId: tvManager.id, userName: 'Karim Ould', action: 'create', entity: 'live_stream', entityId: 'live-1', createdAt: hoursAgo(1) },
      { userId: admin.id, userName: 'Amina Diallo', action: 'update', entity: 'site_setting', entityId: 'identity', data: JSON.stringify({ avant: '...', apres: 'MÉDIA' }), createdAt: hoursAgo(2) },
      { userId: fmProducer.id, userName: 'Claire Vasseur', action: 'create', entity: 'audio_content', entityId: createdAudio['journal-parle-edition-speciale-parlement']?.id ?? null, createdAt: hoursAgo(1) },
    ],
  })

  console.log('✅ Seed terminé.')
  console.log(`   Articles : ${articlesSeed.length} | Audio : ${audioSeed.length} | Vidéos : ${videosSeed.length} | Directs : 3`)
  console.log(`   Connexion démo : admin@media.fr / ${DEMO_PASSWORD} (2FA : code démo 246810)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
