import React from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Phone, Mail, MapPin, Leaf, Clock, ShieldCheck, MessageCircle,
  ArrowRight, Wrench, PackageCheck, Banknote, ExternalLink, Factory
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { Section, SectionHeader, SectionBody } from '../components/Layout';
import { PageHero } from '../components/Hero';
import { Reveal } from '../components/Reveal';
import { STATIC_SEO } from '../lib/pageSeo';
import { BRAND, PARTNER } from '../lib/brand';
import { buildFAQSchema, buildBreadcrumbSchema, buildOrganizationSchema } from '../lib/jsonLdBuilder';

const WHATSAPP_URL = BRAND.whatsappUrl;

/** Shared breadcrumb so all four pages present orientation identically. */
const Crumb: React.FC<{ label: string }> = ({ label }) => (
  <nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
    <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
    <span className="mx-2" aria-hidden="true">/</span>
    <span className="text-ink font-medium">{label}</span>
  </nav>
);

/** Closing conversion block, identical rhythm to the money pages. */
const ClosingCta: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <Section tone="sable" rhythm="loose" bordered>
    <div className="text-center max-w-xl mx-auto">
      <h2 className="text-2xl sm:text-[2rem] font-serif font-bold text-ink">{title}</h2>
      <p className="mt-5 text-sm sm:text-base text-ink-soft leading-relaxed">{body}</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/lampes"
          className="inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-13 rounded-xl transition-colors"
        >
          Voir tout le catalogue
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-white hover:bg-ecru text-ink font-semibold px-7 h-13 rounded-xl border border-pierre-line transition-colors"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          Ecrire sur WhatsApp
        </a>
      </div>
    </div>
  </Section>
);


/**
 * The collaboration, stated in full.
 *
 * Shown on the pages where a buyer goes looking for who is actually behind the
 * shop, so the partnership is a verifiable fact rather than a logo in a footer.
 */
const PartnershipSection: React.FC = () => (
  <Section tone="white" rhythm="default" bordered width="narrow" aria-labelledby="partner-title">
    <SectionHeader
      id="partner-title"
      eyebrow="Notre partenaire"
      title="Une production partagee"
    />

    <SectionBody>
      <div className="bg-ecru border border-pierre-line rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-ambre-soft grid place-items-center shrink-0">
            <Factory className="w-5 h-5 text-terracotta" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif font-bold text-ink text-lg">{PARTNER.name}</h3>
            <p className="text-xs text-pierre-deep mt-1">{PARTNER.role}</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-ink-soft leading-relaxed">{PARTNER.blurb}</p>

        <p className="mt-4 text-sm text-ink-soft leading-relaxed">
          Concretement, cela nous donne acces a un parc de machines professionnel et a
          des matieres certifiees, tout en gardant la conception, la gravure, le montage
          et le controle final dans notre atelier de {BRAND.city.split(',')[0]}.
        </p>

        <a
          href={PARTNER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 bg-white hover:bg-sable-soft text-ink font-semibold px-6 h-12 rounded-xl text-xs border border-pierre-line transition-colors"
        >
          Voir {PARTNER.name}
          <ExternalLink className="w-3.5 h-3.5 text-terracotta shrink-0" aria-hidden="true" />
        </a>
      </div>
    </SectionBody>
  </Section>
);

/* ================================================================== */

const WORKSHOP_PILLARS = [
  {
    icon: Leaf,
    title: 'La matiere',
    body: 'Du PLA vegetal, pas d ABS. Concretement, la coque ne degage pas de styrene en chauffant, ce qui compte pour une lampe qui reste allumee dans une chambre d enfant.',
  },
  {
    icon: Clock,
    title: 'Le controle',
    body: 'Chaque lampe est allumee quatre heures avant emballage. C est la duree au bout de laquelle un defaut de cablage ou une LED faible se revele.',
  },
  {
    icon: Wrench,
    title: 'La reparation',
    body: 'Un abat jour fele se reimprime chez nous en quelques heures. Vous ne remplacez pas la lampe entiere pour une piece cassee.',
  },
  {
    icon: ShieldCheck,
    title: 'La garantie',
    body: '12 mois sur le montage et l electronique. Un message sur WhatsApp suffit a declencher la prise en charge.',
  },
];

export const AboutPage: React.FC = () => {
  const seo = STATIC_SEO['/a-propos'];

  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        path="/a-propos"
        keywords={seo.keywords}
        jsonLd={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'A propos', url: '/a-propos' },
          ]),
        ]}
      />

      <PageHero
        breadcrumb={<Crumb label="A propos" />}
        eyebrow="Notre atelier"
        title="Un atelier d impression 3D a Casablanca"
        lede="Nous imprimons, montons et testons chaque lampe nous memes. Voici exactement comment, et pourquoi cela change ce que vous recevez."
      />

      {/* Story */}
      <Section tone="ecru" rhythm="default" width="narrow">
        <div className="max-w-[68ch] mx-auto space-y-5 text-[0.9375rem] text-ink-soft leading-[1.75]">
          <p className="text-base text-ink font-medium">{BRAND.tagline}</p>
          <p>
            LUCEA est nee d un constat simple. Au Maroc, une lampe decorative se choisit
            presque toujours entre deux extremes: un modele importe bon marche dont
            personne ne connait la matiere, ou une piece de decoration hors de prix qui
            met six semaines a arriver.
          </p>
          <p>
            Nous avons pris la troisieme voie. Nos lampes sont imprimees a la commande
            dans notre atelier de Casablanca, en PLA vegetal issu d amidon de mais. Cela
            nous permet de graver un prenom sans surcout, de reimprimer une piece cassee
            a l identique, et de livrer en 48 heures ce qui prendrait autrement un mois
            et demi.
          </p>
        </div>
      </Section>

      {/* Pillars */}
      <Section tone="white" rhythm="default" bordered aria-labelledby="pillars-title">
        <SectionHeader
          id="pillars-title"
          eyebrow="Nos engagements"
          title="Quatre choses que nous controlons nous memes"
        />

        <SectionBody>
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {WORKSHOP_PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-ecru border border-pierre-line rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-ambre-soft grid place-items-center">
                  <Icon className="w-5 h-5 text-terracotta" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-serif font-bold text-ink text-lg">{title}</h3>
                <p className="mt-3 text-sm text-pierre-deep leading-relaxed">{body}</p>
              </div>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      <PartnershipSection />

      <ClosingCta
        title="Voir ce que nous fabriquons"
        body="Chaque lampe du catalogue sort de cet atelier, avec la gravure de votre choix."
      />
    </>
  );
};

/* ================================================================== */

const FAQ_ITEMS = [
  {
    question: 'Combien de temps prend une commande avec gravure ?',
    answer:
      'Comptez 48 heures de fabrication pour la gravure, puis 24 heures de livraison sur Casablanca et Rabat, 48 heures ailleurs au Maroc. Une commande passee lundi arrive donc en general jeudi.',
  },
  {
    question: 'Comment fonctionne le paiement a la livraison ?',
    answer:
      'Le livreur vous remet le colis, vous l ouvrez devant lui et vous verifiez la lampe ainsi que la gravure. Vous ne reglez qu ensuite, en especes. Si quelque chose ne convient pas, vous refusez le colis et vous ne payez rien.',
  },
  {
    question: 'Puis je retourner une lampe personnalisee ?',
    answer:
      'Une lampe gravee a un prenom ne peut pas etre revendue, elle n est donc pas reprise sauf defaut de fabrication. En revanche, vous pouvez la refuser a la livraison apres verification, ce qui revient au meme pour vous.',
  },
  {
    question: 'Quelle est la duree de vie de l ampoule ?',
    answer:
      'Nos LED sont donnees pour 25000 heures, soit environ huit ans a huit heures par nuit. L ampoule est standard et se remplace en quelques secondes sans outil.',
  },
  {
    question: 'La lampe chauffe t elle ?',
    answer:
      'Elle tiedit legerement au niveau du diffuseur. Une LED de 6 a 9 watts reste tres loin de la temperature a laquelle le PLA commence a se deformer.',
  },
  {
    question: 'Combien de caracteres pour la gravure ?',
    answer:
      'Quinze caracteres au maximum, accents compris. Au dela, le prenom deviendrait trop petit pour rester lisible une fois la lampe allumee.',
  },
  {
    question: 'Livrez vous en dehors des grandes villes ?',
    answer:
      'Oui, nous livrons dans tout le Maroc via notre transporteur partenaire. Comptez 48 a 72 heures pour les villes hors Casablanca, Rabat, Sale et Marrakech.',
  },
  {
    question: 'Comment nettoyer ma lampe ?',
    answer:
      'Un chiffon doux legerement humide suffit. Evitez l alcool et les produits abrasifs qui matifient la surface du PLA.',
  },
];

export const FaqPage: React.FC = () => {
  const seo = STATIC_SEO['/faq'];

  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        path="/faq"
        keywords={seo.keywords}
        jsonLd={[
          buildFAQSchema(FAQ_ITEMS),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Questions frequentes', url: '/faq' },
          ]),
        ]}
      />

      <PageHero
        breadcrumb={<Crumb label="Questions frequentes" />}
        eyebrow="Avant de commander"
        title="Questions frequentes"
        lede="Gravure, livraison, paiement et garantie. Si votre question ne figure pas ici, ecrivez nous, nous repondons le jour meme."
      />

      <Section tone="ecru" rhythm="default" width="narrow">
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group bg-white border border-pierre-line rounded-2xl px-5 py-4 open:border-ambre transition-colors"
            >
              <summary className="font-semibold text-ink text-sm cursor-pointer list-none flex items-start justify-between gap-4">
                <span className="leading-relaxed">{item.question}</span>
                <span
                  className="text-terracotta-deep text-xl leading-none shrink-0 mt-0.5 group-open:rotate-45 transition-transform"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm text-ink-soft leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <ClosingCta
        title="Votre question n est pas dans la liste ?"
        body="Notre atelier repond sur WhatsApp du lundi au samedi, en general dans l heure."
      />
    </>
  );
};

/* ================================================================== */

const ZONES = [
  { zone: 'Casablanca et Bouskoura', delay: '24 heures', cost: '20 MAD', free: 'Offerte des 350 MAD' },
  { zone: 'Rabat, Sale, Marrakech', delay: '24 a 48 heures', cost: '35 MAD', free: 'Offerte des 350 MAD' },
  { zone: 'Reste du Maroc', delay: '48 a 72 heures', cost: '45 MAD', free: 'Offerte des 450 MAD' },
];

const PAYMENT_STEPS = [
  'Le livreur vous appelle pour convenir d un creneau.',
  'Il vous remet le colis et vous le laissez ouvrir devant lui.',
  'Vous verifiez l etat de la lampe et l orthographe de la gravure.',
  'Vous reglez en especes le montant exact indique sur votre confirmation.',
];

export const DeliveryPaymentPage: React.FC = () => {
  const seo = STATIC_SEO['/livraison-paiement'];

  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        path="/livraison-paiement"
        keywords={seo.keywords}
        jsonLd={buildBreadcrumbSchema([
          { name: 'Accueil', url: '/' },
          { name: 'Livraison et paiement', url: '/livraison-paiement' },
        ])}
      />

      <PageHero
        breadcrumb={<Crumb label="Livraison et paiement" />}
        eyebrow="Comment ca marche"
        title="Livraison et paiement"
        lede="Nous livrons partout au Maroc et vous ne reglez qu une fois le colis ouvert et verifie devant le livreur."
      />

      {/* Zones */}
      <Section tone="ecru" rhythm="default" width="narrow" aria-labelledby="zones-title">
        <SectionHeader
          id="zones-title"
          eyebrow="Zones"
          title="Delais et frais par zone"
          subtitle="Les delais courent a partir de la fin de fabrication. Une lampe gravee demande 48 heures d atelier en amont."
        />

        <SectionBody>
          <div className="overflow-x-auto bg-white border border-pierre-line rounded-2xl">
            <table className="w-full text-left text-sm min-w-[34rem]">
              <caption className="sr-only">Delais et frais de livraison par zone</caption>
              <thead className="bg-sable-soft">
                <tr>
                  <th scope="col" className="px-5 py-4 font-serif text-ink">Zone</th>
                  <th scope="col" className="px-5 py-4 font-serif text-ink">Delai</th>
                  <th scope="col" className="px-5 py-4 font-serif text-ink">Frais</th>
                  <th scope="col" className="px-5 py-4 font-serif text-ink">Gratuite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pierre-line text-ink-soft">
                {ZONES.map((z) => (
                  <tr key={z.zone}>
                    <th scope="row" className="px-5 py-4 font-semibold text-ink text-left">{z.zone}</th>
                    <td className="px-5 py-4">{z.delay}</td>
                    <td className="px-5 py-4 tabular-nums">{z.cost}</td>
                    <td className="px-5 py-4 text-succes font-medium">{z.free}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionBody>
      </Section>

      {/* Payment */}
      <Section tone="white" rhythm="default" bordered width="narrow" aria-labelledby="payment-title">
        <SectionHeader
          id="payment-title"
          eyebrow="Paiement"
          title="Comment se passe le paiement"
          subtitle="Le paiement a la livraison est plafonne a 5000 MAD par commande. Au dela, contactez nous pour un virement ou un acompte."
        />

        <SectionBody>
          <Reveal stagger as="ul" className="space-y-4">
            {PAYMENT_STEPS.map((step, index) => (
              <li key={step} className="flex gap-4 bg-ecru border border-pierre-line rounded-2xl p-5">
                <span className="w-8 h-8 rounded-full bg-ambre text-ink font-bold text-xs grid place-items-center shrink-0">
                  {index + 1}
                </span>
                <span className="text-sm text-ink-soft leading-relaxed">{step}</span>
              </li>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* Reassurance */}
      <Section tone="ecru" rhythm="default" width="narrow">
        <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: Truck, title: 'Suivi par telephone', body: 'Nous vous appelons dans l heure pour confirmer la gravure et le creneau.' },
            { icon: PackageCheck, title: 'Colis ouvert avant paiement', body: 'Vous verifiez la lampe et refusez le colis si quelque chose ne va pas.' },
            { icon: Banknote, title: 'Especes uniquement', body: 'Aucune carte bancaire n est demandee, ni au moment de la commande ni a la livraison.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white border border-pierre-line rounded-2xl p-6">
              <Icon className="w-6 h-6 text-terracotta" aria-hidden="true" />
              <h3 className="mt-4 font-serif font-bold text-ink text-base">{title}</h3>
              <p className="mt-2 text-xs text-pierre-deep leading-relaxed">{body}</p>
            </div>
          ))}
        </Reveal>
      </Section>

      <ClosingCta
        title="Une commande deja passee ?"
        body="Suivez son avancement avec votre numero de commande et le telephone utilise a l achat."
      />
    </>
  );
};

/* ================================================================== */

const CONTACT_CHANNELS = [
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    body: `${BRAND.whatsapp}, le canal le plus rapide pour suivre une commande.`,
    href: WHATSAPP_URL,
    external: true,
  },
  {
    icon: Mail,
    title: 'Email',
    body: `${BRAND.email}, pour les devis et les factures avec TVA.`,
    href: 'mailto:contact@luceamaroc.com',
  },
  {
    icon: Phone,
    title: 'Telephone',
    body: 'Du lundi au samedi, de 9h a 19h.',
    href: 'tel:+212600000000',
  },
  {
    icon: MapPin,
    title: 'Atelier',
    body: `${BRAND.city}. Visite sur rendez vous uniquement.`,
  },
];

export const ContactPage: React.FC = () => {
  const seo = STATIC_SEO['/contact'];

  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        path="/contact"
        keywords={seo.keywords}
        jsonLd={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Contact', url: '/contact' },
          ]),
        ]}
      />

      <PageHero
        breadcrumb={<Crumb label="Contact" />}
        eyebrow="Service client"
        title="Nous contacter"
        lede="Une question sur une gravure, une commande en cours ou un devis professionnel ? Nous repondons du lundi au samedi, en general dans l heure."
      />

      <Section tone="ecru" rhythm="default" width="narrow">
        <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CONTACT_CHANNELS.map(({ icon: Icon, title, body, href, external }) => {
            const content = (
              <>
                <Icon className="w-6 h-6 text-terracotta" aria-hidden="true" />
                <h2 className="mt-4 font-serif font-bold text-ink text-lg">{title}</h2>
                <p className="mt-2 text-xs text-pierre-deep leading-relaxed">{body}</p>
              </>
            );

            return href ? (
              <a
                key={title}
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="bg-white border border-pierre-line rounded-2xl p-6 hover:border-ambre transition-colors"
              >
                {content}
              </a>
            ) : (
              <div key={title} className="bg-white border border-pierre-line rounded-2xl p-6">
                {content}
              </div>
            );
          })}
        </Reveal>
      </Section>

      {/* Professional enquiries */}
      <Section tone="white" rhythm="default" bordered width="narrow" aria-labelledby="pro-title">
        <div className="bg-sable border border-pierre-line rounded-2xl p-7 sm:p-8">
          <h2 id="pro-title" className="font-serif font-bold text-ink text-xl">
            Vous etes un professionnel ?
          </h2>
          <p className="mt-4 text-sm text-ink-soft leading-relaxed max-w-[60ch]">
            Cafes, restaurants, hotels et agences evenementielles: nous gravons votre logo
            des 10 pieces et nous envoyons un devis sous 24 heures ouvrees, facture avec
            TVA comprise.
          </p>
          <Link
            to="/pro-hotellerie-evenementiel"
            className="mt-7 inline-flex items-center gap-2 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-6 h-12 rounded-xl text-xs transition-colors"
          >
            Voir l offre professionnelle
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <PartnershipSection />

      <ClosingCta
        title="Parcourir le catalogue"
        body="Toutes nos lampes sont imprimees a Casablanca, gravees a la demande et livrees en 24 a 48 heures."
      />
    </>
  );
};
