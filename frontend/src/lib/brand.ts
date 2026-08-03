// Brand and partnership facts.
//
// One source, because this copy appears in the footer, on the information
// pages, in the Organization schema and in the order confirmation PDF. Three
// slightly different versions of the same sentence is how a brand starts to
// look improvised.

export const BRAND = {
  name: 'LUCÉA MAROC',
  tagline:
    'Atelier marocain de lampes et veilleuses imprimées en 3D. Nous gravons le prénom de votre choix et nous expédions dans tout le pays.',
  whatsapp: '06 00 00 00 00',
  whatsappUrl: 'https://wa.me/212600000000',
  email: 'contact@luceamaroc.com',
  city: 'Casablanca, Maroc',
} as const;

export const PARTNER = {
  name: '3D Print Maroc',
  url: 'https://www.3dprintmaroc.com/',
  /** Shown wherever the collaboration is credited. */
  role: 'Partenaire technique impression 3D',
  blurb:
    'Nos pièces sont produites en collaboration avec 3D Print Maroc, notre partenaire technique pour l impression 3D professionnelle au Maroc.',
} as const;
