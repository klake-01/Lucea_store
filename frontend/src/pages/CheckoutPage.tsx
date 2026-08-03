import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, Truck, Lock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Seo } from '../components/Seo';
import { Section } from '../components/Layout';
import { fetchApi } from '../lib/api';
import { formatMad } from '../lib/format';

const CITIES = [
  { value: 'Casablanca', label: 'Casablanca, livraison en 24h' },
  { value: 'Bouskoura', label: 'Bouskoura, livraison en 24h' },
  { value: 'Rabat', label: 'Rabat, livraison en 24h a 48h' },
  { value: 'Sale', label: 'Sale, livraison en 24h a 48h' },
  { value: 'Marrakech', label: 'Marrakech, livraison en 24h a 48h' },
  { value: 'Tanger', label: 'Tanger, livraison en 48h' },
  { value: 'Agadir', label: 'Agadir, livraison en 48h' },
  { value: 'Fes', label: 'Fes, livraison en 48h' },
  { value: 'Meknes', label: 'Meknes, livraison en 48h' },
  { value: 'Oujda', label: 'Oujda, livraison en 48h' },
  { value: 'Autre ville', label: 'Autre ville du Maroc, 48h a 72h' },
];

/** Accepts 06/07 local format and the +212 international form. */
const isValidMoroccanPhone = (value: string) => {
  const digits = value.replace(/[^\d+]/g, '');
  return /^(?:0[5-7]\d{8}|\+212[5-7]\d{8})$/.test(digits);
};

export const CheckoutPage: React.FC = () => {
  const { cart, city, setCity, voucherCode, clearCart } = useCart();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <Section tone="ecru" rhythm="loose" width="narrow" className="text-center space-y-4">
        <Seo
          title="Votre panier est vide | LUCEA Maroc"
          description="Votre panier LUCEA est vide. Parcourez nos veilleuses prenom et nos lampes design imprimees en 3D au Maroc."
          path="/checkout"
          noindex
        />
        <h1 className="text-2xl font-serif font-bold text-ink">Votre panier est vide</h1>
        <p className="text-sm text-pierre-deep">
          Ajoutez une lampe pour continuer vers la commande.
        </p>
        <Link
          to="/lampes"
          className="inline-block bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-6 py-3 rounded-xl text-sm transition-colors"
        >
          Voir nos lampes
        </Link>
      </Section>
    );
  }

  const validate = () => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 3) errors.name = 'Indiquez votre nom complet.';
    if (!isValidMoroccanPhone(phone)) {
      errors.phone = 'Numero invalide. Format attendu 0612345678 ou +212612345678.';
    }
    if (addressLine.trim().length < 8) {
      errors.address = 'Precisez le quartier, la rue et le numero.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const order = await fetchApi('/orders', {
        method: 'POST',
        auth: false,
        headers: {
          // Guards against a double submit creating two identical orders
          'Idempotency-Key': `${cart!.id}-${phone.trim()}`,
        },
        body: JSON.stringify({
          cart_id: cart!.id,
          name: name.trim(),
          phone: phone.trim(),
          city,
          address_line: addressLine.trim(),
          payment_method: 'COD',
          voucher_code: voucherCode,
        }),
      });

      if (order?.id) {
        clearCart();
        navigate(`/order-success/${order.id}?phone=${encodeURIComponent(phone.trim())}`);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'La commande n a pas pu etre enregistree.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section tone="ecru" rhythm="tight" className="space-y-8">
      <Seo
        title="Finaliser ma commande | LUCEA Maroc"
        description="Renseignez votre adresse de livraison. Vous reglez en especes a la reception du colis, apres verification."
        path="/checkout"
        noindex
      />

      <header className="text-center space-y-2">
        <h1 className="text-3xl font-serif font-bold text-ink">Finaliser votre commande</h1>
        <p className="text-sm text-pierre-deep flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-terracotta" aria-hidden="true" />
          Aucune carte bancaire demandee, vous payez a la reception
        </p>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="bg-alerte-soft border border-alerte/30 text-alerte p-4 rounded-xl text-sm flex items-start gap-2 max-w-2xl mx-auto"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <form onSubmit={handlePlaceOrder} noValidate className="lg:col-span-3 bg-white border border-pierre-line p-6 rounded-2xl space-y-5">
          <h2 className="text-lg font-serif font-bold text-ink pb-3 border-b border-pierre-line">
            Informations de livraison
          </h2>

          <div>
            <label htmlFor="name" className="text-xs font-semibold text-ink block mb-1.5">
              Nom complet
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Par exemple Salma Mansouri"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              className={`w-full bg-ecru border rounded-xl p-3 text-sm text-ink focus:outline-none focus:border-terracotta ${
                fieldErrors.name ? 'border-alerte' : 'border-pierre-line'
              }`}
            />
            {fieldErrors.name && (
              <p id="name-error" className="text-[11px] text-alerte mt-1">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="text-xs font-semibold text-ink block mb-1.5">
              Telephone, de preference WhatsApp
            </label>
            <input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="0612345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? 'phone-error' : 'phone-help'}
              className={`w-full bg-ecru border rounded-xl p-3 text-sm text-ink focus:outline-none focus:border-terracotta ${
                fieldErrors.phone ? 'border-alerte' : 'border-pierre-line'
              }`}
            />
            {fieldErrors.phone ? (
              <p id="phone-error" className="text-[11px] text-alerte mt-1">{fieldErrors.phone}</p>
            ) : (
              <p id="phone-help" className="text-[11px] text-pierre-deep mt-1">
                Le livreur vous appelle avant de passer.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="city" className="text-xs font-semibold text-ink block mb-1.5">
              Ville de livraison
            </label>
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-ecru border border-pierre-line rounded-xl p-3 text-sm text-ink focus:outline-none focus:border-terracotta"
            >
              {CITIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-pierre-deep mt-1">
              Les frais de livraison se mettent a jour automatiquement.
            </p>
          </div>

          <div>
            <label htmlFor="address" className="text-xs font-semibold text-ink block mb-1.5">
              Adresse complete
            </label>
            <textarea
              id="address"
              required
              rows={3}
              autoComplete="street-address"
              placeholder="Quartier, rue, numero d immeuble et d appartement"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              aria-invalid={Boolean(fieldErrors.address)}
              aria-describedby={fieldErrors.address ? 'address-error' : undefined}
              className={`w-full bg-ecru border rounded-xl p-3 text-sm text-ink focus:outline-none focus:border-terracotta ${
                fieldErrors.address ? 'border-alerte' : 'border-pierre-line'
              }`}
            />
            {fieldErrors.address && (
              <p id="address-error" className="text-[11px] text-alerte mt-1">{fieldErrors.address}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ambre hover:bg-ambre-deep hover:text-white disabled:opacity-50 text-ink font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Enregistrement en cours
              </>
            ) : (
              <>
                Confirmer ma commande
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>

          <p className="text-[11px] text-pierre-deep text-center">
            En confirmant, vous acceptez de regler {formatMad(cart?.total_cents)} en especes au livreur.
          </p>
        </form>

        <aside className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-pierre-line p-6 rounded-2xl space-y-4">
            <h2 className="text-base font-serif font-bold text-ink pb-3 border-b border-pierre-line">
              Recapitulatif, {items.length} article{items.length > 1 ? 's' : ''}
            </h2>

            <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-xs border-b border-pierre-line pb-2.5 last:border-0">
                  <div className="min-w-0">
                    <span className="font-medium text-ink block truncate">
                      {item.product_name || 'Lampe LUCEA'}
                    </span>
                    {item.config_text && (
                      <span className="text-[11px] text-terracotta-deep block">
                        Prenom grave : {item.config_text}
                      </span>
                    )}
                    <span className="text-[11px] text-pierre-deep block">Quantite {item.quantity}</span>
                  </div>
                  <span className="font-semibold text-ink whitespace-nowrap">
                    {formatMad(item.item_total_cents)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-2 text-xs text-ink-soft pt-1">
              <div className="flex justify-between">
                <span>Sous total</span>
                <span className="tabular-nums">{formatMad(cart?.subtotal_cents)}</span>
              </div>
              {(cart?.discount_cents ?? 0) > 0 && (
                <div className="flex justify-between text-succes font-semibold">
                  <span>Remise {voucherCode}</span>
                  <span className="tabular-nums">moins {formatMad(cart?.discount_cents)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Livraison vers {city}</span>
                <span className="tabular-nums">
                  {(cart?.delivery_charge_cents ?? 0) === 0 ? 'Offerte' : formatMad(cart?.delivery_charge_cents)}
                </span>
              </div>
              <div className="flex justify-between text-base font-serif font-bold text-ink pt-2.5 border-t border-pierre-line">
                <span>A payer au livreur</span>
                <span className="tabular-nums">{formatMad(cart?.total_cents)}</span>
              </div>
            </div>
          </div>

          <div className="bg-sable border border-pierre-line p-4 rounded-2xl space-y-2 text-xs text-ink-soft">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <ShieldCheck className="w-4 h-4 text-terracotta" aria-hidden="true" />
              Vous ouvrez avant de payer
            </p>
            <p>
              Le livreur vous laisse verifier la lampe et la gravure. Si quelque chose ne va pas,
              vous refusez le colis et vous ne payez rien.
            </p>
            <p className="flex items-center gap-1.5 font-semibold text-ink pt-1">
              <Truck className="w-4 h-4 text-terracotta" aria-hidden="true" />
              Suivi par telephone
            </p>
            <p>Nous vous appelons dans l heure pour confirmer la gravure et le creneau.</p>
          </div>
        </aside>
      </div>
    </Section>
  );
};
