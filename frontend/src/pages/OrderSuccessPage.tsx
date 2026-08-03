import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, ArrowLeft, Phone, Package } from 'lucide-react';
import { Seo } from '../components/Seo';
import { Section } from '../components/Layout';
import { fetchApi } from '../lib/api';
import { formatMad } from '../lib/format';

export const OrderSuccessPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!orderId || !phone) return;
    let cancelled = false;

    fetchApi(`/orders/${orderId}?phone=${encodeURIComponent(phone)}`, { auth: false })
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [orderId, phone]);

  const reference = order?.order_number || orderId;
  const whatsappMessage = encodeURIComponent(
    `Bonjour LUCEA, je confirme ma commande numero ${reference}.`
  );

  return (
    <Section tone="ecru" rhythm="default" width="narrow" className="text-center space-y-8">
      <Seo
        title="Commande confirmee | LUCEA Maroc"
        description="Votre commande LUCEA est enregistree. Nous vous appelons dans l heure pour confirmer la gravure et le creneau de livraison."
        path={`/order-success/${orderId}`}
        noindex
      />

      <div className="space-y-4">
        <div className="w-16 h-16 bg-succes-soft text-succes rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
        </div>

        <h1 className="text-3xl font-serif font-bold text-ink">Commande enregistree</h1>
        <p className="text-sm text-ink-soft">
          Votre numero de commande est{' '}
          <span className="font-mono font-bold text-terracotta-deep">{reference}</span>.
          Notez le, il vous servira pour toute question.
        </p>
      </div>

      {/* What happens next, removes the post purchase uncertainty */}
      <ol className="bg-white border border-pierre-line rounded-2xl p-6 text-left space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-ambre text-ink font-bold text-xs flex items-center justify-center flex-shrink-0">1</span>
          <div>
            <span className="font-semibold text-ink block">Nous vous appelons dans l heure</span>
            <span className="text-pierre-deep text-xs">
              Pour confirmer l orthographe de la gravure et le creneau de livraison.
            </span>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-ambre text-ink font-bold text-xs flex items-center justify-center flex-shrink-0">2</span>
          <div>
            <span className="font-semibold text-ink block">Fabrication en 48 heures</span>
            <span className="text-pierre-deep text-xs">
              Votre lampe est imprimee, montee puis allumee 4 heures avant emballage.
            </span>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-ambre text-ink font-bold text-xs flex items-center justify-center flex-shrink-0">3</span>
          <div>
            <span className="font-semibold text-ink block">Livraison et paiement</span>
            <span className="text-pierre-deep text-xs">
              Vous ouvrez le colis devant le livreur, puis vous reglez en especes.
            </span>
          </div>
        </li>
      </ol>

      {order && (
        <div className="bg-white border border-pierre-line p-6 rounded-2xl text-left space-y-4">
          <h2 className="font-serif font-bold text-ink text-base pb-3 border-b border-pierre-line">
            Details de la livraison
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-pierre-deep block">Destinataire</dt>
              <dd className="font-medium text-ink">{order.name}</dd>
            </div>
            <div>
              <dt className="text-pierre-deep block">Telephone</dt>
              <dd className="font-medium text-ink">{order.phone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-pierre-deep block">Adresse</dt>
              <dd className="font-medium text-ink">{order.address_line}, {order.city}</dd>
            </div>
            <div>
              <dt className="text-pierre-deep block">Montant a regler</dt>
              <dd className="font-bold text-ink text-sm">{formatMad(order.total_cents)}</dd>
            </div>
            <div>
              <dt className="text-pierre-deep block">Mode de paiement</dt>
              <dd className="font-medium text-ink">Especes a la reception</dd>
            </div>
          </dl>

          {order.items?.length > 0 && (
            <ul className="pt-3 border-t border-pierre-line space-y-2 text-xs">
              {order.items.map((item: any) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <span className="text-ink-soft">
                    <Package className="w-3.5 h-3.5 inline mr-1.5 text-terracotta" aria-hidden="true" />
                    {item.snapshotted_product_name}
                    {item.config_text && (
                      <span className="text-terracotta-deep"> , grave {item.config_text}</span>
                    )}
                    <span className="text-pierre-deep"> x{item.quantity}</span>
                  </span>
                  <span className="font-semibold text-ink whitespace-nowrap">
                    {formatMad(item.snapshotted_price_cents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-sable border border-pierre-line p-6 rounded-2xl space-y-3">
        <h2 className="text-sm font-serif font-bold text-ink">Besoin d une expedition prioritaire ?</h2>
        <p className="text-xs text-ink-soft">
          Ecrivez nous sur WhatsApp avec votre numero de commande, nous placerons votre lampe
          en tete de file de l atelier.
        </p>
        <a
          href={`https://wa.me/212600000000?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-ink hover:bg-ink-soft text-ecru font-bold px-6 py-3 rounded-xl text-xs transition-colors"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          Confirmer sur WhatsApp
        </a>
        <p className="text-[11px] text-pierre-deep flex items-center justify-center gap-1.5">
          <Phone className="w-3 h-3" aria-hidden="true" />
          Ou appelez nous au 06 00 00 00 00
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-8 gap-y-3">
        <Link
          to={`/suivi-commande?commande=${encodeURIComponent(reference || '')}`}
          className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-terracotta-deep hover:text-terracotta"
        >
          Suivre cette commande
        </Link>
        <Link
          to="/lampes"
          className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-terracotta-deep hover:text-terracotta"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Continuer mes achats
        </Link>
      </div>
    </Section>
  );
};
