import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Seo } from '../components/Seo';
import { PageHero } from '../components/Hero';
import { Section } from '../components/Layout';
import { StarInput } from '../components/Stars';
import { fetchApi, ApiError } from '../lib/api';
import { BRAND } from '../lib/brand';

export const ReviewSubmitPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({
    title: '',
    body: '',
    author_name: '',
    author_city: '',
    author_email: '',
    author_phone: '',
    order_number: params.get('commande') ?? '',
    product_id: params.get('produit') ?? '',
  });
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetchApi('/catalog/products?limit=60', { auth: false, signal: controller.signal })
      .then((d) => setProducts(d?.items ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!rating) errs.rating = 'Choisissez une note de 1 à 5.';
    if (form.author_name.trim().length < 2) errs.author_name = 'Indiquez votre prénom.';
    if (form.body.trim().length < 20) {
      errs.body = 'Détaillez votre avis en 20 caractères au minimum.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await fetchApi('/reviews', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          rating,
          title: form.title.trim() || null,
          body: form.body.trim(),
          author_name: form.author_name.trim(),
          author_city: form.author_city.trim() || null,
          author_email: form.author_email.trim() || null,
          author_phone: form.author_phone.trim() || null,
          order_number: form.order_number.trim() || null,
          product_id: form.product_id || null,
        }),
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'L envoi a échoué. Réessayez dans un instant.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- thank you ---------------- */
  if (done) {
    return (
      <>
        <Seo title="Merci pour votre avis | LUCÉA Maroc" description="Votre avis a bien été enregistré." path="/avis/nouveau" noindex />
        <Section tone="ecru" rhythm="loose" width="narrow">
          <div className="bg-white border border-pierre-line rounded-2xl p-8 sm:p-10 text-center">
            <span className="w-14 h-14 rounded-full bg-succes-soft text-succes grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-2xl font-serif font-bold text-ink">
              Merci, votre avis est bien enregistré
            </h1>
            {/*
              Deliberately does not say whether the review is already live. The
              routing threshold is not something the form should teach, and a
              customer who left a low rating should hear from a person, not from
              a status message.
            */}
            <p className="mt-4 text-sm text-ink-soft leading-relaxed max-w-md mx-auto">
              Notre atelier lit chaque retour. Si vous avez signalé un problème,
              nous vous recontactons sous 24 heures ouvrées.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/avis"
                className="inline-flex items-center justify-center bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-7 h-12 rounded-xl text-sm transition-colors"
              >
                Voir les avis clients
              </Link>
              <Link
                to="/lampes"
                className="inline-flex items-center justify-center bg-ecru hover:bg-sable-soft text-ink font-semibold px-7 h-12 rounded-xl text-sm border border-pierre-line transition-colors"
              >
                Continuer mes achats
              </Link>
            </div>
          </div>
        </Section>
      </>
    );
  }

  /* ---------------- form ---------------- */
  return (
    <>
      <Seo
        title="Laisser un avis | LUCÉA Maroc"
        description="Partagez votre expérience avec votre lampe LUCÉA. Votre retour aide les prochains acheteurs et notre atelier."
        path="/avis/nouveau"
        keywords={['laisser un avis lucea', 'avis client lampe maroc']}
      />

      <PageHero
        breadcrumb={
          <nav aria-label="Fil d ariane" className="text-[11px] text-pierre-deep">
            <Link to="/" className="hover:text-terracotta-deep">Accueil</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <Link to="/avis" className="hover:text-terracotta-deep">Avis</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span className="text-ink font-medium">Laisser un avis</span>
          </nav>
        }
        eyebrow="Votre expérience"
        title="Laisser un avis"
        lede="Dites nous ce qui vous a plu, et ce qui ne va pas. Les deux nous sont utiles."
      />

      <Section tone="ecru" rhythm="default" width="narrow">
        <form onSubmit={handleSubmit} noValidate className="bg-white border border-pierre-line rounded-2xl p-6 sm:p-8 space-y-6">

          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Votre note <span className="text-alerte">*</span>
            </legend>
            <div className="mt-3">
              <StarInput value={rating} onChange={(v) => { setRating(v); setFieldErrors((e) => ({ ...e, rating: '' })); }} />
            </div>
            {fieldErrors.rating && (
              <p className="mt-2 text-[11px] text-alerte">{fieldErrors.rating}</p>
            )}
          </fieldset>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Titre, optionnel</span>
            <input
              type="text"
              maxLength={120}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Une lampe magnifique"
              className="mt-2 w-full h-12 bg-ecru border border-pierre-line rounded-xl px-4 text-base sm:text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">
              Votre avis <span className="text-alerte">*</span>
            </span>
            <textarea
              rows={5}
              maxLength={2000}
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder="Qualité, lumière, gravure, livraison, emballage: ce qui compte pour vous."
              aria-invalid={Boolean(fieldErrors.body)}
              className={`mt-2 w-full bg-ecru border rounded-xl p-4 text-base sm:text-sm text-ink placeholder:text-pierre-deep focus:outline-none focus:border-terracotta ${
                fieldErrors.body ? 'border-alerte' : 'border-pierre-line'
              }`}
            />
            <span className="mt-1.5 flex justify-between text-[11px] text-pierre-deep">
              <span>{fieldErrors.body || 'Minimum 20 caractères.'}</span>
              <span className="tabular-nums">{form.body.length}/2000</span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink">
                Prénom <span className="text-alerte">*</span>
              </span>
              <input
                type="text"
                value={form.author_name}
                onChange={(e) => set('author_name', e.target.value)}
                placeholder="Imane"
                aria-invalid={Boolean(fieldErrors.author_name)}
                className={`mt-2 w-full h-12 bg-ecru border rounded-xl px-4 text-base sm:text-sm text-ink focus:outline-none focus:border-terracotta ${
                  fieldErrors.author_name ? 'border-alerte' : 'border-pierre-line'
                }`}
              />
              {fieldErrors.author_name && (
                <span className="mt-1.5 block text-[11px] text-alerte">{fieldErrors.author_name}</span>
              )}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Ville</span>
              <input
                type="text"
                value={form.author_city}
                onChange={(e) => set('author_city', e.target.value)}
                placeholder="Casablanca"
                className="mt-2 w-full h-12 bg-ecru border border-pierre-line rounded-xl px-4 text-base sm:text-sm text-ink focus:outline-none focus:border-terracotta"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-ink">La lampe concernée</span>
            <select
              value={form.product_id}
              onChange={(e) => set('product_id', e.target.value)}
              className="mt-2 w-full h-12 bg-ecru border border-pierre-line rounded-xl px-3 text-base sm:text-sm text-ink focus:outline-none focus:border-terracotta"
            >
              <option value="">Je préfère ne pas préciser</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {/* Contact block, explained rather than just asked for */}
          <fieldset className="bg-ecru border border-pierre-line rounded-xl p-5">
            <legend className="px-2 text-xs font-semibold text-ink">
              Pour vous recontacter, optionnel
            </legend>
            <p className="text-[11px] text-pierre-deep leading-relaxed">
              Ces informations ne sont jamais publiées. Elles nous servent
              uniquement à vous répondre si quelque chose ne va pas, et à
              afficher la mention achat vérifié.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-ink">Numéro de commande</span>
                <input
                  type="text"
                  value={form.order_number}
                  onChange={(e) => set('order_number', e.target.value.toUpperCase())}
                  placeholder="LUC-20260728-1234"
                  className="mt-1.5 w-full h-11 bg-white border border-pierre-line rounded-xl px-3 text-base sm:text-xs text-ink focus:outline-none focus:border-terracotta"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink">Téléphone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.author_phone}
                  onChange={(e) => set('author_phone', e.target.value)}
                  placeholder="0612345678"
                  className="mt-1.5 w-full h-11 bg-white border border-pierre-line rounded-xl px-3 text-base sm:text-xs text-ink focus:outline-none focus:border-terracotta"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-ink">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.author_email}
                  onChange={(e) => set('author_email', e.target.value)}
                  placeholder="vous@example.com"
                  className="mt-1.5 w-full h-11 bg-white border border-pierre-line rounded-xl px-3 text-base sm:text-xs text-ink focus:outline-none focus:border-terracotta"
                />
              </label>
            </div>

            <p className="mt-4 flex items-start gap-2 text-[11px] text-pierre-deep">
              <ShieldCheck className="w-3.5 h-3.5 text-terracotta shrink-0 mt-px" aria-hidden="true" />
              Le numéro de commande et le téléphone doivent correspondre pour
              obtenir la mention achat vérifié.
            </p>
          </fieldset>

          {error && (
            <p role="alert" className="bg-alerte-soft border border-alerte/25 text-alerte text-sm p-4 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-deep text-white font-semibold px-8 h-13 rounded-xl transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Envoyer mon avis
            </button>
            <button
              type="button"
              onClick={() => navigate('/avis')}
              className="inline-flex items-center justify-center gap-2 bg-ecru hover:bg-sable-soft text-ink font-semibold px-7 h-13 rounded-xl border border-pierre-line transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Retour aux avis
            </button>
          </div>

          <p className="text-[11px] text-pierre-deep">
            Une question urgente ? Écrivez nous sur{' '}
            <a href={BRAND.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-terracotta-deep font-semibold underline underline-offset-2">
              WhatsApp
            </a>
            , nous répondons le jour même.
          </p>
        </form>
      </Section>
    </>
  );
};
