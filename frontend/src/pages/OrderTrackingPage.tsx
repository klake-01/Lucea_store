import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Package, Truck, CheckCircle2, Clock, AlertCircle, Loader2,
  ShieldCheck, MessageCircle, XCircle
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { PageHero } from '../components/Hero';
import { Section, SectionBody } from '../components/Layout';
import { Reveal } from '../components/Reveal';
import { fetchApi, ApiError } from '../lib/api';
import { formatMad } from '../lib/format';
import { TRACKING_SEO } from '../lib/pageSeo';
import { buildBreadcrumbSchema, buildFAQSchema } from '../lib/jsonLdBuilder';

const STEP_ICONS: Record<string, typeof Package> = {
  pending: Clock,
  confirmed: CheckCircle2,
  dispatched: Truck,
  delivered: Package,
  cancelled: XCircle,
  returned: XCircle,
};

const FAQ = [
  {
    question: 'Ou trouver mon numero de commande ?',
    answer:
      'Il apparait sur la page de confirmation juste apres votre commande, au format LUC suivi de la date et de quatre chiffres. Nous vous le rappelons aussi lors de l appel de confirmation.',
  },
  {
    question: 'Pourquoi mon telephone est il demande ?',
    answer:
      'Un numero de commande seul serait devinable. En demandant aussi le telephone utilise a la commande, nous garantissons que personne d autre que vous ne peut consulter votre suivi.',
  },
  {
    question: 'Mon suivi indique En attente depuis hier, est ce normal ?',
    answer:
      'Oui. Une commande reste en attente jusqu a notre appel de confirmation, qui a lieu pendant les heures ouvrables du lundi au samedi. La fabrication demarre juste apres.',
  },
  {
    question: 'Combien de temps avant de recevoir ma lampe ?',
    answer:
      'Comptez 48 heures de fabrication si votre lampe est gravee, puis 24 heures de livraison sur Casablanca et Rabat et 48 a 72 heures ailleurs au Maroc.',
  },
];

export const OrderTrackingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('commande') ?? '');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!orderNumber.trim() || !phone.trim()) {
      setError('Renseignez votre numero de commande et votre telephone.');
      return;
    }

    setLoading(true);
    try {
      const data = await fetchApi('/orders/track', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          order_number: orderNumber.trim(),
          phone: phone.trim(),
        }),
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Le suivi est momentanement indisponible. Reessayez dans un instant.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isStopped = result && ['cancelled', 'returned'].includes(result.status);

  return (
    <>
      <Seo
        title={TRACKING_SEO.title}
        description={TRACKING_SEO.description}
        path="/suivi-commande"
        keywords={TRACKING_SEO.keywords}
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Accueil', url: '/' },
            { name: 'Suivi de commande', url: '/suivi-commande' },
          ]),
          buildFAQSchema(FAQ),
        ]}
      />

      <PageHero
        breadcrumb={
          <nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
            <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span className="text-ink font-medium">Suivi de commande</span>
          </nav>
        }
        eyebrow="Service client"
        title="Suivre ma commande"
        lede="Entrez votre numero de commande et le telephone utilise au moment de l achat. Vous verrez immediatement ou en est votre lampe."
      />

      {/* ---------- Lookup form ---------- */}
      <Section tone="ecru" rhythm="default" width="narrow">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-pierre-line rounded-2xl p-6 sm:p-8"
          noValidate
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="order-number" className="text-xs font-semibold text-ink block">
                Numero de commande
              </label>
              <input
                id="order-number"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="LUC-20260727-1234"
                autoComplete="off"
                spellCheck={false}
                className="mt-2.5 w-full h-13 bg-ecru border border-pierre-line rounded-xl px-4 text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta focus:ring-3 focus:ring-terracotta/12 uppercase"
              />
            </div>

            <div>
              <label htmlFor="track-phone" className="text-xs font-semibold text-ink block">
                Telephone utilise a la commande
              </label>
              <input
                id="track-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0612345678"
                className="mt-2.5 w-full h-13 bg-ecru border border-pierre-line rounded-xl px-4 text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta focus:ring-3 focus:ring-terracotta/12"
              />
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[11px] text-pierre-deep">
            <ShieldCheck className="w-3.5 h-3.5 text-terracotta shrink-0 mt-px" aria-hidden="true" />
            Les deux informations sont demandees pour que personne d autre que vous
            ne puisse consulter votre commande.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-8 h-13 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Recherche en cours
              </>
            ) : (
              <>
                <Search className="w-4 h-4" aria-hidden="true" />
                Voir ma commande
              </>
            )}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-5 bg-alerte-soft border border-alerte/25 text-alerte text-sm p-4 rounded-xl flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{error}</span>
            </p>
          )}
        </form>

        {/* ---------- Result ---------- */}
        {result && (
          <div className="mt-8" aria-live="polite">
            <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
              <div className="px-6 sm:px-8 py-6 border-b border-pierre-line flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-pierre-deep">Commande</p>
                  <p className="mt-1 font-mono font-bold text-ink">{result.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-pierre-deep">Statut</p>
                  <p
                    className={`mt-1 font-semibold text-sm ${
                      isStopped ? 'text-alerte' : 'text-succes'
                    }`}
                  >
                    {result.status_label}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <ol className="px-6 sm:px-8 py-7 space-y-0">
                {result.timeline.map((step: any, index: number) => {
                  const Icon = STEP_ICONS[step.status] ?? Package;
                  const isLast = index === result.timeline.length - 1;
                  return (
                    <li key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${
                            step.reached
                              ? isStopped
                                ? 'bg-alerte-soft text-alerte'
                                : 'bg-ambre text-ink'
                              : 'bg-ecru text-pierre-deep border border-pierre-line'
                          }`}
                        >
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        {!isLast && (
                          <span
                            className={`w-px flex-1 min-h-10 my-1 ${
                              step.reached ? 'bg-ambre' : 'bg-pierre-line'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <div className={isLast ? 'pb-0' : 'pb-6'}>
                        <p
                          className={`text-sm font-semibold ${
                            step.reached ? 'text-ink' : 'text-pierre-deep'
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.created_at && (
                          <p className="mt-1 text-[11px] text-pierre-deep">
                            {new Date(step.created_at).toLocaleDateString('fr-MA', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {result.estimated_delivery && (
                <p className="mx-6 sm:mx-8 mb-7 bg-sable-soft text-ink-soft text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                  <Truck className="w-4 h-4 text-terracotta shrink-0" aria-hidden="true" />
                  Livraison estimee vers {result.city} : {result.estimated_delivery}
                </p>
              )}

              {/* Contents */}
              <div className="px-6 sm:px-8 py-6 border-t border-pierre-line">
                <h2 className="text-sm font-serif font-bold text-ink">Contenu de la commande</h2>
                <ul className="mt-4 space-y-3">
                  {result.items.map((item: any, i: number) => (
                    <li key={i} className="flex items-start justify-between gap-4 text-xs">
                      <span className="text-ink-soft">
                        {item.product_name}
                        {item.config_text && (
                          <span className="text-terracotta-deep"> , grave {item.config_text}</span>
                        )}
                        <span className="text-pierre-deep"> x{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-ink whitespace-nowrap tabular-nums">
                        {formatMad(item.line_total_cents)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-5 pt-5 border-t border-pierre-line space-y-2 text-xs text-ink-soft">
                  <div className="flex justify-between gap-3">
                    <dt>Sous total</dt>
                    <dd className="tabular-nums">{formatMad(result.subtotal_cents)}</dd>
                  </div>
                  {result.discount_cents > 0 && (
                    <div className="flex justify-between gap-3 text-succes font-semibold">
                      <dt>Remise</dt>
                      <dd className="tabular-nums">moins {formatMad(result.discount_cents)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt>Livraison</dt>
                    <dd className="tabular-nums">
                      {result.delivery_charge_cents === 0
                        ? 'Offerte'
                        : formatMad(result.delivery_charge_cents)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 pt-2.5 border-t border-pierre-line text-sm font-serif font-bold text-ink">
                    <dt>{result.status === 'delivered' ? 'Montant regle' : 'A regler au livreur'}</dt>
                    <dd className="tabular-nums">{formatMad(result.total_cents)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mt-5 bg-sable border border-pierre-line rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-ink-soft leading-relaxed">
                Une question sur cette commande, {result.recipient_first_name} ? Ecrivez nous
                avec votre numero, nous repondons le jour meme.
              </p>
              <a
                href={`https://wa.me/212600000000?text=${encodeURIComponent(
                  `Bonjour LUCEA, une question sur ma commande ${result.order_number}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-ink hover:bg-ink-soft text-ecru font-bold px-6 h-12 rounded-xl text-xs shrink-0 transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                Contacter l atelier
              </a>
            </div>
          </div>
        )}
      </Section>

      {/* ---------- How it works ---------- */}
      <Section tone="white" rhythm="default" bordered width="narrow" aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-xl sm:text-2xl font-serif font-bold text-ink text-center">
          Les quatre etapes d une commande LUCEA
        </h2>

        <SectionBody className="mt-8 sm:mt-10">
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              ['Commande recue', 'Votre commande entre dans la file de l atelier. Rien n est preleve, le paiement se fait a la livraison.'],
              ['Confirmee par telephone', 'Nous vous appelons pour valider l orthographe de la gravure et le creneau de livraison.'],
              ['Remise au livreur', 'La lampe est imprimee, montee, allumee 4 heures puis emballee et confiee au transporteur.'],
              ['Livree et payee', 'Vous ouvrez le colis devant le livreur, vous verifiez, puis vous reglez en especes.'],
            ].map(([title, body], i) => (
              <div key={title} className="bg-ecru border border-pierre-line rounded-2xl p-6">
                <span className="w-8 h-8 rounded-full bg-ambre text-ink font-bold text-xs grid place-items-center">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-serif font-bold text-ink text-base">{title}</h3>
                <p className="mt-2 text-xs text-pierre-deep leading-relaxed">{body}</p>
              </div>
            ))}
          </Reveal>
        </SectionBody>
      </Section>

      {/* ---------- FAQ ---------- */}
      <Section tone="ecru" rhythm="default" width="narrow" aria-labelledby="track-faq-title">
        <h2 id="track-faq-title" className="text-xl sm:text-2xl font-serif font-bold text-ink text-center">
          Questions sur le suivi
        </h2>

        <SectionBody className="mt-8">
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.question}
                className="group bg-white border border-pierre-line rounded-2xl px-5 py-4"
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
        </SectionBody>
      </Section>
    </>
  );
};
