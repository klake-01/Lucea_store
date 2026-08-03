import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Loader2, TrendingUp, TrendingDown, ShoppingBag, Wallet,
  PackageX, Star, Mail, AlertTriangle, ArrowRight, Boxes
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatMad } from '../../lib/format';
import { ChartCard, TrendChart, BarList, StatusDonut, RatingBars } from '../../components/admin/Charts';

// Simple Error Boundary component
class DashboardErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="bg-alerte-soft border border-alerte/30 text-alerte p-8 rounded-2xl text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-alerte" />
          <h2 className="text-lg font-serif font-bold text-ink mb-2">Erreur d'affichage</h2>
          <p className="text-sm">{this.state.error?.message || "Impossible de charger le tableau de bord."}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-white rounded-lg border border-alerte text-xs font-semibold hover:bg-alerte-soft">Recharger</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  dispatched: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  returned: 'Retournée',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#d98e4a',
  confirmed: '#3f6480',
  dispatched: '#8c8578',
  delivered: '#3f7d52',
  cancelled: '#b3452f',
  returned: '#a34e30',
};

/** A headline number with its change against the previous period. */
const Metric: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  change?: number | null;
  tone?: 'default' | 'warn' | 'success';
}> = ({ icon: Icon, label, value, hint, change, tone = 'default' }) => (
  <div className={`bg-white border rounded-2xl p-5 ${tone === 'warn' ? 'border-alerte/30' : tone === 'success' ? 'border-succes/30' : 'border-pierre-line'} shadow-sm hover:shadow-md transition-shadow`}>
    <div className="flex items-center justify-between gap-3">
      <span className={`w-10 h-10 rounded-xl grid place-items-center ${
        tone === 'warn' ? 'bg-alerte-soft' : tone === 'success' ? 'bg-succes-soft' : 'bg-ambre-soft'
      }`}>
        <Icon className={`w-5 h-5 ${tone === 'warn' ? 'text-alerte' : tone === 'success' ? 'text-succes' : 'text-terracotta'}`} aria-hidden="true" />
      </span>

      {change !== undefined && change !== null && (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md ${
          change >= 0 ? 'bg-succes-soft text-succes' : 'bg-alerte-soft text-alerte'
        }`}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change >= 0 ? '+' : ''}{change}%
        </span>
      )}
    </div>

    <p className="mt-4 text-2xl font-serif font-bold text-ink tabular-nums leading-none">{value}</p>
    <p className="text-xs font-semibold text-ink-soft mt-1.5">{label}</p>
    {hint && <p className="text-[11px] text-pierre-deep mt-1 leading-snug">{hint}</p>}
  </div>
);

const AdminDashboardContent: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchApi(`/auth/admin/dashboard?days=${days}`));
    } catch (err: any) {
      setError(err?.message || 'Chargement du tableau de bord impossible.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-pierre-deep">
        <span className="flex flex-col items-center gap-3 text-sm">
          <Loader2 className="w-8 h-8 animate-spin text-terracotta" aria-hidden="true" />
          Chargement des statistiques...
        </span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div role="alert" className="bg-alerte-soft border border-alerte/30 text-alerte p-5 rounded-2xl text-sm">
        {error}
      </div>
    );

  }

  const t = data.totals;
  const p = data.period;
  const rates = data.rates;
  const rv = data.reviews;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Tableau de bord</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Chiffre d affaires calculé sur les commandes livrées uniquement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="period" className="sr-only">Période</label>
          <select
            id="period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-11 bg-white border border-pierre-line rounded-xl px-3 text-xs text-ink focus:outline-none focus:border-terracotta"
          >
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="h-11 flex items-center gap-2 bg-white border border-pierre-line hover:border-ambre text-ink text-xs font-semibold px-3.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Actualiser
          </button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          icon={Wallet}
          label="Chiffre d affaires encaissé"
          value={formatMad(t.revenue_cents)}
          hint={`Panier moyen ${formatMad(t.average_order_cents)}`}
          change={p.revenue_change_percent}
        />
        <Metric
          icon={ShoppingBag}
          label="Commandes au total"
          value={String(t.orders)}
          hint={`${t.open_orders} en cours`}
          change={p.orders_change_percent}
        />
        <Metric
          icon={Boxes}
          label="En attente d encaissement"
          value={formatMad(t.pipeline_cents)}
          hint={`${t.units_reserved} unités réservées`}
        />
        <Metric
          icon={PackageX}
          label="Taux de refus"
          value={rates.refusal_rate === null ? '—' : `${rates.refusal_rate}%`}
          hint={`sur ${rates.settled_orders} commandes soldées`}
          tone={rates.refusal_rate !== null && rates.refusal_rate > 25 ? 'warn' : 'default'}
        />
      </div>

      {/* Things that need a person today */}
      {(t.pending_orders > 0 || rv.pending > 0) && (
        <div className="bg-ambre-soft border border-ambre/30 rounded-2xl p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-terracotta-deep">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            À traiter aujourd hui
          </p>
          {t.pending_orders > 0 && (
            <Link to="/admin/orders" className="inline-flex items-center gap-1.5 min-h-10 text-xs font-semibold text-ink hover:text-terracotta-deep">
              {t.pending_orders} commande{t.pending_orders > 1 ? 's' : ''} à confirmer
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
          {rv.pending > 0 && (
            <Link to="/admin/reviews" className="inline-flex items-center gap-1.5 min-h-10 text-xs font-semibold text-ink hover:text-terracotta-deep">
              {rv.pending} avis à relire
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {/* Trend */}
      <ChartCard
        title="Évolution du chiffre d affaires"
        subtitle={`Commandes livrées sur ${data.period_days} jours. ${formatMad(p.revenue_cents)} encaissés, ${p.orders} commandes reçues.`}
      >
        <TrendChart series={data.series} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Répartition des commandes" subtitle="Par statut, depuis le lancement">
          <StatusDonut data={data.status_breakdown} labels={STATUS_LABELS} colors={STATUS_COLORS} />
        </ChartCard>

        <ChartCard
          title="Avis clients"
          subtitle={rv.pending ? `${rv.pending} en attente de relecture` : 'Rien en attente'}
          action={
            <Link to="/admin/reviews" className="text-[11px] font-semibold text-terracotta-deep hover:text-terracotta">
              Gérer
            </Link>
          }
        >
          <RatingBars distribution={rv.distribution} average={rv.average_rating} />
        </ChartCard>

        <ChartCard title="Produits Vedettes" subtitle="Unités commandées, hors annulations">
          <BarList
            items={data.top_products.map((prod: any, index: number) => {
              // Add badges based on position to represent Best Seller, Top Rated, High Stock
              const badges = index === 0 ? ' 🔥' : index === 1 ? ' ⭐' : index === 2 ? ' 📦' : '';
              return {
                label: `${prod.name}${badges}`,
                value: prod.units,
                hint: formatMad(prod.revenue_cents),
              };
            })}
            formatValue={(v) => `${v} u.`}
          />
        </ChartCard>

        <ChartCard title="Villes les plus actives" subtitle="Par nombre de commandes">
          <BarList
            items={data.top_cities.map((c: any) => ({
              label: c.city,
              value: c.orders,
              hint: formatMad(c.revenue_cents),
            }))}
          />
        </ChartCard>
      </div>

      {/* Inventory and audience */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Stock le plus bas"
          subtitle="Disponible = en stock moins réservé"
          className="lg:col-span-2"
          action={
            <Link to="/admin/products" className="text-[11px] font-semibold text-terracotta-deep hover:text-terracotta">
              Gérer les stocks
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[26rem]">
              <thead className="text-pierre-deep">
                <tr>
                  <th scope="col" className="pb-2 font-semibold">Produit</th>
                  <th scope="col" className="pb-2 font-semibold">SKU</th>
                  <th scope="col" className="pb-2 font-semibold text-right">En stock</th>
                  <th scope="col" className="pb-2 font-semibold text-right">Réservé</th>
                  <th scope="col" className="pb-2 font-semibold text-right">Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pierre-line">
                {data.low_stock.map((v: any) => (
                  <tr key={v.sku}>
                    <td className="py-2.5 text-ink">{v.product}</td>
                    <td className="py-2.5 font-mono text-pierre-deep">{v.sku}</td>
                    <td className="py-2.5 text-right tabular-nums">{v.stock}</td>
                    <td className="py-2.5 text-right tabular-nums text-terracotta-deep">{v.reserved}</td>
                    <td className={`py-2.5 text-right tabular-nums font-semibold ${
                      v.available === 0 ? 'text-alerte' : v.available <= 5 ? 'text-terracotta-deep' : 'text-ink'
                    }`}>
                      {v.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard
          title="Audience"
          subtitle="Inscrits à l offre de bienvenue"
          action={
            <Link to="/admin/customers" className="text-[11px] font-semibold text-terracotta-deep hover:text-terracotta">
              Voir
            </Link>
          }
        >
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-ink tabular-nums">{t.subscribers}</span>
            <span className="text-[11px] text-pierre-deep">adresses</span>
          </p>
          <p className="mt-2 text-[11px] text-succes font-semibold">
            +{p.new_subscribers} sur la période
          </p>

          <div className="mt-5 pt-4 border-t border-pierre-line space-y-2.5 text-[11px]">
            <p className="flex items-center justify-between gap-3">
              <span className="text-pierre-deep inline-flex items-center gap-1.5">
                <Star className="w-3 h-3" aria-hidden="true" /> Avis publiés
              </span>
              <span className="font-semibold text-ink tabular-nums">{rv.published}</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-pierre-deep inline-flex items-center gap-1.5">
                <Mail className="w-3 h-3" aria-hidden="true" /> Taux de livraison
              </span>
              <span className="font-semibold text-ink tabular-nums">
                {rates.delivery_rate === null ? '—' : `${rates.delivery_rate}%`}
              </span>
            </p>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export const AdminDashboard = () => (
  <DashboardErrorBoundary>
    <AdminDashboardContent />
  </DashboardErrorBoundary>
);
