// LUCEA SEO strategy: the cluster registry is the source of truth for which
// page owns which query. Navigation labels, money page copy and the sitemap
// all read from here so a keyword can never be claimed by two pages.

export interface SEOCluster {
  id: string;
  name: string;
  /** Compact label for the header navigation. */
  shortLabel: string;
  headQuery: string;
  moneyPageUrl: string;
  persona: string;
  /** Category slug used to filter the catalogue on the money page. */
  categorySlug: string;
  /** Above the fold promise, answers "is this page for me". */
  promise: string;
  /** Three proof points shown under the hero. */
  proofPoints: string[];
  /** Lifestyle photograph used by the home page collection cards. */
  image?: string;
  /** One line that says what the collection is for, used on the cards. */
  cardBlurb?: string;
  faqs: { question: string; answer: string }[];
  primaryKeywords: string[];
  secondaryKeywords: string[];
  /**
   * Wording of the money page's primary call to action. Falls back to a
   * neutral label, because "Creer ma veilleuse" is nonsense on the office
   * lighting collection.
   */
  /**
   * The page's visible headline. Kept separate from the SEO title: the title
   * is written for a result listing, the h1 is written for a reader.
   */
  h1?: string;
  ctaLabel?: string;
  /**
   * Occasions the collection is bought for. Only set where gifting is a real
   * motive, so the gift block is absent rather than invented on the
   * professional and office pages.
   */
  giftOccasions?: { label: string; note: string }[];
}

export const CLUSTERS: SEOCluster[] = [
  {
    id: "lampe-personnalisee-cadeau",
    name: "Veilleuses et cadeaux personnalisés",
    shortLabel: "Veilleuses prénom",
    headQuery: "veilleuse prenom bebe",
    moneyPageUrl: "/lampe-personnalisee-cadeau",
    persona: "Salma",
    categorySlug: "veilleuses-personnalisees",
    promise:
      "Une veilleuse gravée au prénom de votre enfant, fabriquée en 48h dans notre atelier de Casablanca et livrée prête à offrir.",
    proofPoints: [
      // Salma's first ranked objection is the spelling of the engraving, so it
      // is answered before anything else. 00-foundation/04 section 2.
      "Prénom relu et validé avec vous avant l'impression, accents compris",
      "Lumière LED 2700 kelvins, assez douce pour rester allumée toute la nuit",
      "PLA végétal issu d'amidon de maïs, sans ABS ni solvant",
      "Coffret cadeau et carte manuscrite offerts sur demande",
    ],
    image: "/images/collections/veilleuses.webp",
    cardBlurb: "Gravées au prénom de votre choix, parfait pour offrir.",
    faqs: [
      {
        question: "Comment personnaliser ma veilleuse prénom ?",
        answer:
          "Le champ de personnalisation se trouve sur la fiche produit, juste au-dessus du bouton d'ajout au panier. Vous pouvez saisir jusqu à quinze caractères, accents compris.",
      },
      {
        question: "Combien de temps prend la fabrication ?",
        answer:
          "Comptez 48 heures de fabrication, puis 24 heures de livraison sur Casablanca et Rabat et 48 heures ailleurs au Maroc. Une commande passée lundi arrive donc en général jeudi.",
      },
      {
        question: "La veilleuse est-elle sans danger pour bébé ?",
        answer:
          "Oui. La coque est imprimée en PLA végétal qui ne dégage pas de styrène en chauffant, l'ampoule LED reste tiède au toucher et le socle est lesté pour résister à une chute de la table de chevet.",
      },
      {
        question: "Puis-je offrir la veilleuse en cadeau ? Est-ce que l'emballage est prévu ?",
        answer:
          "Oui. Chaque veilleuse part dans un coffret cadeau avec une carte manuscrite si vous le demandez. Indiquez l'adresse du destinataire à la commande, aucune facture ni mention de prix n'est glissée dans le colis.",
      },
    ],
    primaryKeywords: [
      "veilleuse prenom bebe",
      "lampe prenom grave",
      "veilleuse personnalisee maroc",
      "lampe prenom",
    ],
    secondaryKeywords: [
      "idee cadeau naissance original",
      "veilleuse bebe securite",
      "personnalisation prenom maroc",
    ],
    h1: "Veilleuse prénom bébé personnalisée",
    ctaLabel: "Créer ma veilleuse personnalisée",
    giftOccasions: [
      { label: "Naissance", note: "Le prénom du nouveau-né, prêt avant le retour de la maternité." },
      { label: "Baby shower", note: "Un cadeau que personne d'autre n'aura, parce qu'il est unique." },
      { label: "Anniversaire", note: "De un à dix ans, le prénom reste, la veilleuse suit." },
      { label: "Baptême", note: "Un objet qui se garde, plutôt qu'un jouet de plus." },
      { label: "Fin d'année", note: "Commandez avant le 15 décembre pour une livraison sereine." },
      { label: "Fête des mères", note: "Le prénom de l'enfant, offert à celle qui l'a choisi." },
    ],
  },
  {
    id: "lampe-chevet-chambre",
    name: "Lampes de chevet et chambre",
    shortLabel: "Chevet",
    headQuery: "lampe de chevet maroc",
    moneyPageUrl: "/lampe-chevet-chambre",
    persona: "Lina",
    categorySlug: "lampes-chevet",
    promise:
      "Des lampes de chevet à lumière chaude qui remplacent le plafonnier le soir et vous laissent lire sans réveiller la personne à côté.",
    proofPoints: [
      "Vendues par paire assortie pour éclairer les deux côtés du lit",
      "Interrupteur à molette sur le câble, aucune manipulation debout",
      "Câble textile de 1,5 mètre, compatible avec les prises marocaines",
    ],
    image: "/images/collections/chevet.webp",
    cardBlurb: "Une lumière douce pour des nuits apaisantes.",
    faqs: [
      {
        question: "Quelle hauteur de lampe de chevet choisir ?",
        answer:
          "Le bas de l abat jour doit arriver au niveau de votre epaule quand vous etes assis dans le lit. Nos modeles de 24 a 35 centimetres conviennent aux tables de chevet standard.",
      },
      {
        question: "Les ampoules sont elles fournies ?",
        answer:
          "Oui, chaque lampe est livree avec son ampoule LED 2700 kelvins deja montee et testee quatre heures avant l expedition.",
      },
      {
        question: "Puis je commander une seule lampe du duo ?",
        answer:
          "Le duo est vendu ensemble pour garantir deux teintes de lumiere identiques. Ecrivez nous sur WhatsApp si vous avez besoin d une piece seule, nous imprimons a la demande.",
      },
    ],
    primaryKeywords: [
      "lampe de chevet maroc",
      "duo lampes chevet",
      "lampe de chevet chambre maroc",
    ],
    secondaryKeywords: [
      "quelle lumiere pour s endormir",
      "lampe de chevet design",
      "luminaire chambre rabat",
    ],
    h1: "Lampes de chevet pour une chambre apaisée",
    ctaLabel: "Choisir ma lampe de chevet",
  },
  {
    id: "lampe-salon-design",
    name: "Lampes de salon et ambiance",
    shortLabel: "Salon",
    headQuery: "lampe salon moderne maroc",
    moneyPageUrl: "/lampe-salon-design",
    persona: "Anas",
    categorySlug: "lampes-salon",
    promise:
      "Des lampes d ambiance au motif zellige qui dessinent la lumière sur vos murs et rendent le salon utilisable le soir sans plafonnier.",
    proofPoints: [
      "Motif zellige projeté sur les murs et le plafond une fois allumée",
      "Socle lesté et câble textile tressé de 2 mètres",
      "Compatible avec toute ampoule E27 jusqu à 12 watts",
    ],
    image: "/images/collections/salon.webp",
    cardBlurb: "Créez une ambiance chaleureuse et élégante chez vous.",
    faqs: [
      {
        question: "Quelle puissance d ampoule pour un salon ?",
        answer:
          "Pour une lampe d ambiance, restez entre 6 et 9 watts en LED. Au dela, le motif projete se dilue et la lumiere devient trop directe pour une soiree.",
      },
      {
        question: "La lampe chauffe t elle ?",
        answer:
          "Non. Une LED de 9 watts fait tiedir l abat jour sans jamais depasser une temperature dangereuse pour le PLA, qui commence a se deformer bien au dessus.",
      },
      {
        question: "Peut on l utiliser sur une terrasse ?",
        answer:
          "En interieur ou sous un abri sec uniquement. Le PLA supporte mal l exposition directe au soleil sur de longues periodes.",
      },
    ],
    primaryKeywords: [
      "lampe salon moderne maroc",
      "lampe zellige",
      "lampadaire maroc",
      "suspension design salon",
    ],
    secondaryKeywords: [
      "quelle puissance ampoule salon",
      "comparatif lampe 3d",
      "luminaire casablanca",
    ],
    h1: "Lampes de salon au motif zellige",
    ctaLabel: "Choisir ma lampe de salon",
  },
  {
    id: "lampe-bureau-teletravail",
    name: "Lampes de bureau et télétravail",
    shortLabel: "Bureau",
    headQuery: "lampe de bureau maroc",
    moneyPageUrl: "/lampe-bureau-teletravail",
    persona: "Anas",
    categorySlug: "lampes-bureau",
    promise:
      "Une lampe de bureau orientable qui eclaire le plan de travail sans renvoyer de reflet dans votre ecran.",
    proofPoints: [
      "Trois temperatures de lumiere, de 2700 a 5000 kelvins",
      "Intensite reglable en continu, sans paliers brusques",
      "Alimentation USB C, 7 watts au maximum",
    ],
    image: "/images/collections/bureau.webp",
    cardBlurb: "Design et confort lumineux pour votre productivité.",
    faqs: [
      {
        question: "Comment eviter les reflets sur l ecran ?",
        answer:
          "Placez la lampe sur le cote, legerement en avant du bord de l ecran, et orientez le diffuseur vers le clavier. L ecran produit deja sa propre lumiere, inutile de l eclairer.",
      },
      {
        question: "Quelle temperature de lumiere pour travailler ?",
        answer:
          "5000 kelvins le matin pour la concentration, 2700 kelvins en fin de journee pour ne pas retarder l endormissement. Notre modele permet de basculer entre les deux.",
      },
      {
        question: "Fonctionne t elle sur une batterie externe ?",
        answer:
          "Oui, l alimentation est en USB C et consomme 7 watts au maximum, ce qui la rend compatible avec la plupart des batteries nomades.",
      },
    ],
    primaryKeywords: [
      "lampe de bureau maroc",
      "eclairage bureau teletravail",
      "lampe bureau led",
    ],
    secondaryKeywords: [
      "eclairer son bureau sans reflet",
      "lampe usb c bureau",
      "pla recycle",
    ],
    h1: "Lampes de bureau pour le télétravail",
    ctaLabel: "Choisir ma lampe de bureau",
  },
  {
    id: "pro-hotellerie-evenementiel",
    name: "Professionnels, cafés et hôtels",
    shortLabel: "Professionnels",
    headQuery: "luminaire professionnel maroc",
    moneyPageUrl: "/pro-hotellerie-evenementiel",
    persona: "Rachid",
    categorySlug: "luminaires-professionnels",
    promise:
      "Des lampes de table sans fil pour vos salles et terrasses, gravees a votre logo, avec devis sous 24 heures ouvrees.",
    proofPoints: [
      "18 heures d autonomie en intensite moyenne, soit deux services",
      "Gravure de votre logo des 10 pieces, sans frais de moule",
      "Facture avec TVA et tarif degressif au volume",
    ],
    image: "/images/collections/salon.webp",
    cardBlurb: "Cafés, restaurants et hôtels, gravure de votre logo.",
    faqs: [
      {
        question: "A partir de combien de pieces le tarif devient il degressif ?",
        answer:
          "Des 10 pieces. Le tarif baisse par palier a 10, 30 et 60 unites. Envoyez nous votre volume cible et nous vous renvoyons une grille complete.",
      },
      {
        question: "Fournissez vous une facture avec TVA ?",
        answer:
          "Oui, systematiquement pour toute commande professionnelle. Indiquez votre raison sociale et votre identifiant fiscal a la commande.",
      },
      {
        question: "Que se passe t il si une lampe casse en salle ?",
        answer:
          "Nous reimprimons la piece a l identique dans notre atelier. C est le principal avantage d un fournisseur local face a un modele importe qu il faut remplacer entierement.",
      },
      {
        question: "Quel est le delai pour une commande de 50 pieces ?",
        answer:
          "Comptez dix jours ouvres pour 50 pieces gravees, livraison comprise. Nous confirmons la date exacte sur le devis.",
      },
    ],
    primaryKeywords: [
      "luminaire professionnel maroc",
      "grossiste luminaire casablanca",
      "lampe sans fil restaurant",
    ],
    secondaryKeywords: [
      "devis luminaire pro",
      "logo personnalise lampe 3d",
      "facture pro tva maroc",
    ],
    h1: "Luminaires pour cafés, hôtels et événements",
    ctaLabel: "Demander un devis professionnel",
  },
];

export function getClusterByKeyword(keyword: string): SEOCluster | undefined {
  const needle = keyword.toLowerCase();
  return CLUSTERS.find(
    (c) => c.primaryKeywords.includes(needle) || c.secondaryKeywords.includes(needle)
  );
}

export function getClusterByPath(pathname: string): SEOCluster | undefined {
  return CLUSTERS.find((c) => c.moneyPageUrl === pathname);
}

/** Every indexable route, consumed by the sitemap generator and prerenderer. */
export function getAllRoutes(): string[] {
  const routes = [
    "/",
    "/lampes",
    "/a-propos",
    "/faq",
    "/livraison-paiement",
    "/contact",
    "/suivi-commande",
    "/avis",
    "/guides",
    "/guides/guide-choisir-veilleuse-bebe-maroc",
    "/guides/duo-lampes-chevet-astuces-chambre",
    "/guides/eclairage-bureau-teletravail-sans-reflet",
    "/guides/lampe-3d-vs-lampe-importee-comparatif",
    "/guides/luminaire-professionnel-cafe-hotel-maroc",
  ];

  CLUSTERS.forEach((c) => routes.push(c.moneyPageUrl));

  return routes;
}
