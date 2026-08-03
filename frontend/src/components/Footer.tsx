import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, Leaf, MessageCircle } from 'lucide-react';
import { CLUSTERS } from '../lib/seoStrategy';
import { Container } from './Layout';
import { BRAND, PARTNER } from '../lib/brand';

const WHATSAPP_URL = BRAND.whatsappUrl;

const GUARANTEES = [
  {
    icon: Truck,
    title: 'Livraison rapide partout au Maroc',
    body: '24 heures sur Casablanca et Rabat, 48 heures dans les autres villes.',
  },
  {
    icon: ShieldCheck,
    title: 'Paiement à la livraison',
    body: 'Vous ouvrez le colis devant le livreur et vous payez seulement ensuite.',
  },
  {
    icon: Leaf,
    title: 'PLA végétal, imprimé à Casablanca',
    body: 'Une matière issue d amidon de maïs, sans ABS ni solvant, garantie 12 mois.',
  },
];

const INFO_LINKS = [
  { to: '/suivi-commande', label: 'Suivre ma commande' },
  { to: '/lampes', label: 'Toutes nos lampes' },
  { to: '/avis', label: 'Avis clients' },
  { to: '/guides', label: 'Guides et conseils' },
  { to: '/faq', label: 'Questions fréquentes' },
  { to: '/livraison-paiement', label: 'Livraison et paiement' },
  { to: '/a-propos', label: 'À propos de l atelier' },
  { to: '/contact', label: 'Nous contacter' },
];

const COMMITMENTS = [
  'Garantie 12 mois sur toutes nos lampes',
  'Chaque pièce allumée 4 heures avant expédition',
  'Pièce cassée réimprimée dans notre atelier',
  'Réponse le jour même du lundi au samedi',
];

export const Footer: React.FC = () => (
  <footer className="bg-sable border-t border-pierre-line mt-auto">
    <Container>
      {/* Trust row, repeated at the bottom of every page for late deciders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12 border-b border-pierre-line">
        {GUARANTEES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-4">
            <Icon className="w-6 h-6 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-ink text-sm leading-snug">{title}</h2>
              <p className="mt-2 text-xs text-pierre-deep leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 py-14">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/lucea-mark.png"
              alt=""
              width={36}
              height={35}
              loading="lazy"
              decoding="async"
              className="h-9 w-auto"
            />
            <p className="text-xl font-serif font-bold text-ink tracking-[0.04em]">{BRAND.name}</p>
          </div>
          <p className="mt-4 text-xs text-pierre-deep leading-relaxed">{BRAND.tagline}</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 min-h-11 text-xs font-semibold text-terracotta-deep hover:text-terracotta"
          >
            <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            WhatsApp {BRAND.whatsapp}
          </a>

          {/* Collaboration, credited on every page rather than buried on one */}
          <div className="mt-6 pt-5 border-t border-pierre-line/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-pierre-deep">
              En collaboration avec
            </p>
            {/* The supplied partner mark has white wordmark text, so it is
                used on the dark chip it was designed for, not recoloured. */}
            <a
              href={PARTNER.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-block rounded-xl"
              aria-label={`${PARTNER.name}, ouvre un nouvel onglet`}
            >
              <img
                src="/brand/partner-3dprintmaroc.png"
                alt={PARTNER.name}
                width={178}
                height={124}
                loading="lazy"
                decoding="async"
                className="h-14 w-auto"
              />
            </a>
            <p className="mt-2 text-[11px] text-pierre-deep leading-relaxed">{PARTNER.role}</p>
          </div>
        </div>

        <nav aria-labelledby="footer-collections">
          <h2 id="footer-collections" className="font-serif font-semibold text-ink text-sm">
            Nos collections
          </h2>
          <ul className="mt-5 space-y-3 text-xs">
            {CLUSTERS.map((c) => (
              <li key={c.id}>
                <Link
                  to={c.moneyPageUrl}
                  className="inline-flex items-center min-h-10 text-pierre-deep hover:text-terracotta-deep transition-colors"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-info">
          <h2 id="footer-info" className="font-serif font-semibold text-ink text-sm">
            Informations
          </h2>
          <ul className="mt-5 space-y-3 text-xs">
            {INFO_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex items-center min-h-10 text-pierre-deep hover:text-terracotta-deep transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-serif font-semibold text-ink text-sm">Nos engagements</h2>
          <ul className="mt-5 space-y-3 text-xs text-pierre-deep">
            {COMMITMENTS.map((item) => (
              <li key={item} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="py-7 border-t border-pierre-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-pierre-deep">
        <p>{new Date().getFullYear()} LUCÉA Maroc. Tous droits réservés.</p>
        <p>
          Fabriqué à {BRAND.city.split(',')[0]} avec{' '}
          <a
            href={PARTNER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-3 text-terracotta-deep hover:text-terracotta font-medium"
          >
            {PARTNER.name}
          </a>
          , livré dans tout le Maroc.
        </p>
      </div>
    </Container>
  </footer>
);
