// One entry per route: title, description and keyword set.
//
// Titles use a pipe as brand separator (no dashes anywhere in visible copy).
// Keyword lists come from the cluster register in seoStrategy.ts so a page and
// its cluster never claim different terms.

import { CLUSTERS, SEOCluster } from './seoStrategy';

export interface PageSeo {
  title: string;
  description: string;
  keywords: string[];
}

export const HOME_SEO: PageSeo = {
  title: "Veilleuses prénom et lampes 3D | LUCEA Maroc",
  description:
    "Veilleuses gravées au prénom et lampes design imprimées en 3D au Maroc. Livraison en 24h à Casablanca et Rabat, paiement à la livraison, PLA végétal sans ABS.",
  keywords: [
    "veilleuse prenom bébé",
    "lampe personnalisée maroc",
    "lampe 3d maroc",
    "veilleuse personnalisée casablanca",
    "luminaire design maroc",
  ],
};

export const HUB_SEO: PageSeo = {
  title: "Toutes nos lampes et veilleuses 3D | LUCEA Maroc",
  description:
    "Catalogue complet des luminaires LUCEA: veilleuses prénom, lampes de chevet, lampes de salon et lampes de bureau. Livraison offerte dès 350 MAD, paiement à la réception.",
  keywords: [
    "catalogue lampes maroc",
    "veilleuse personnalisée maroc",
    "lampe de chevet maroc",
    "lampe salon moderne maroc",
    "acheter lampe 3d maroc",
  ],
};

export const GUIDES_SEO: PageSeo = {
  title: "Guides éclairage et déco | LUCEA Maroc",
  description:
    "Nos guides pour choisir une veilleuse bébé, éclairer une chambre, un salon ou un bureau au Maroc. Conseils concrets rédigés par notre atelier de Casablanca.",
  keywords: [
    "guide veilleuse bébé",
    "conseils eclairage maison",
    "quelle lumière pour dormir",
    "eclairage bureau télétravail",
    "deco luminaire maroc",
  ],
};

export const TRACKING_SEO: PageSeo = {
  title: "Suivre ma commande | LUCEA Maroc",
  description:
    "Suivez votre commande LUCEA avec votre numéro de commande et le téléphone utilisé à l'achat. Statut, étapes de fabrication et date de livraison estimée.",
  keywords: [
    "suivi commande lucea",
    "suivre ma commande maroc",
    "ou est ma commande",
    "suivi livraison lampe maroc",
    "numéro de commande lucea",
  ],
};

export const STATIC_SEO: Record<string, PageSeo> = {
  // /avis was missing here, so it fell through to the HOME_SEO default in
  // scripts/prerender.ts and shipped the home page's title and description.
  // Two URLs claiming the same title is a duplicate-content signal, and the
  // reviews page is exactly the page a hesitant buyer searches for by name.
  '/avis': {
    title: "Avis clients vérifiés | LUCEA Maroc",
    description:
      "Les avis de nos clients au Maroc sur nos veilleuses prénom et nos lampes imprimées en 3D: qualité de la gravure, délais réels et paiement à la livraison.",
    keywords: [
      "avis lucea maroc",
      "avis veilleuse personnalisée",
      "temoignages clients lampe maroc",
      "avis verifies luminaire maroc",
    ],
  },
  '/a-propos': {
    title: "À propos de notre atelier | LUCEA Maroc",
    description:
      "LUCEA imprime ses lampes en 3D à Casablanca en PLA végétal. Notre atelier, nos matières, nos délais de fabrication et notre garantie de 12 mois expliqués en détail.",
    keywords: [
      "atelier impression 3d casablanca",
      "lampe fabriquee au maroc",
      "pla végétal lampe",
      "marque luminaire marocaine",
    ],
  },
  '/faq': {
    title: "Questions fréquentes | LUCEA Maroc",
    description:
      "Délais de gravure, livraison, paiement à la livraison, retours, garantie et entretien: toutes les réponses avant de commander une lampe LUCEA au Maroc.",
    keywords: [
      "faq veilleuse personnalisée",
      "delai livraison lampe maroc",
      "paiement à la livraison maroc",
      "retour lampe personnalisée",
    ],
  },
  '/livraison-paiement': {
    title: "Livraison et paiement à la livraison | LUCEA Maroc",
    description:
      "Livraison en 24h à Casablanca et Rabat, 48h dans le reste du Maroc. Paiement en espèces à la réception après vérification du colis. Frais et zones détaillés.",
    keywords: [
      "livraison lampe maroc",
      "paiement à la livraison maroc",
      "cash on delivery maroc",
      "frais de livraison casablanca",
    ],
  },
  '/contact': {
    title: "Nous contacter | LUCEA Maroc",
    description:
      "Une question sur une gravure, une commande ou un devis professionnel? Écrivez-nous sur WhatsApp ou par email, nous répondons le jour même du lundi au samedi.",
    keywords: [
      "contact lucea maroc",
      "devis luminaire professionnel maroc",
      "service client lampe maroc",
    ],
  },
};

/** Money page metadata, derived from the cluster it owns. */
export function clusterSeo(cluster: SEOCluster): PageSeo {
  const copy: Record<string, { title: string; description: string }> = {
    'lampe-personnalisee-cadeau': {
      title: "Veilleuse prénom bébé personnalisée | LUCEA Maroc",
      description:
        "Veilleuse gravée au prénom de votre bébé, imprimée en 3D au Maroc. Lumière LED douce 2700K, PLA végétal, fabrication en 48h et paiement à la livraison.",
    },
    'lampe-chevet-chambre': {
      title: "Lampe de chevet design au Maroc | LUCEA",
      description:
        "Lampes de chevet et duos assortis pour une chambre apaisante. Lumière chaude 2700K, interrupteur sur câble, livraison en 24h à Casablanca et Rabat.",
    },
    'lampe-salon-design': {
      title: "Lampe de salon moderne au Maroc | LUCEA",
      description:
        "Lampes de salon au motif zellige imprimées en 3D. Elles projettent un motif de lumière sur vos murs et remplacent un plafonnier trop cru en soirée.",
    },
    'lampe-bureau-teletravail': {
      title: "Lampe de bureau pour télétravail | LUCEA Maroc",
      description:
        "Lampe de bureau orientable sans reflet sur écran. Trois températures de lumière, intensité réglable, alimentation USB C et livraison partout au Maroc.",
    },
    'pro-hotellerie-evenementiel': {
      title: "Luminaire professionnel café et hôtel | LUCEA Maroc",
      description:
        "Lampes de table sans fil pour cafés, restaurants et hôtels au Maroc. 18h d'autonomie, gravure de votre logo dès 10 pièces, devis et facture avec TVA.",
    },
  };

  const entry = copy[cluster.id];
  return {
    title: entry?.title ?? `${cluster.name} | LUCEA Maroc`,
    description:
      entry?.description ??
      `Découvrez la collection ${cluster.name} de LUCEA. Fabrication 3D au Maroc, livraison rapide et paiement à la livraison.`,
    keywords: [...cluster.primaryKeywords, ...cluster.secondaryKeywords].slice(0, 8),
  };
}

/** Look up a money page by its URL, used by the router driven pages. */
export function clusterByPath(pathname: string): SEOCluster | undefined {
  return CLUSTERS.find((c) => c.moneyPageUrl === pathname);
}
