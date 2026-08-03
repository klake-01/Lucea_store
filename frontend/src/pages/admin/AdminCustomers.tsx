import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, Loader2, X, Phone, MapPin, ShieldAlert, ShieldCheck, Eye,
  Users, Mail, Download
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatMad } from '../../lib/format';

const RISK_STYLES: Record<string, string> = {
  ok: 'bg-succes-soft text-succes',
  watch: 'bg-ambre-soft text-terracotta-deep',
  high: 'bg-alerte-soft text-alerte',
};

const RISK_LABELS: Record<string, string> = {
  ok: 'Fiable',
  watch: 'A surveiller',
  high: 'Risque eleve',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmee',
  dispatched: 'Expediee',
  delivered: 'Livree',
  cancelled: 'Annulee',
  returned: 'Retournee',
};

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  // Buyers and interested visitors are different audiences, so they get their
  // own tab rather than one list that distorts both sets of numbers.
  const [tab, setTab] = useState<'buyers' | 'subscribers'>('buyers');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const data = await fetchApi(`/admin/customers${query}`);
      setCustomers(data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Chargement des clients impossible.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const data = await fetchApi(`/admin/subscribers${query}`);
      setSubscribers(data?.items ?? []);
      setSubsTotal(data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Chargement des inscrits impossible.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const run = tab === 'buyers' ? load : loadSubscribers;
    const timer = setTimeout(run, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, loadSubscribers, search, tab]);

  /** Exports the audience so it can be loaded into an email tool. */
  const exportSubscribers = () => {
    const rows = [
      ['email', 'source', 'inscrit_le', 'desinscrit'],
      ...subscribers.map((sub: any) => [
        sub.email, sub.source,
        new Date(sub.created_at).toISOString().slice(0, 10),
        sub.unsubscribed ? 'oui' : 'non',
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lucea-inscrits-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCustomer = async (customer: any) => {
    setSelected(customer);
    setOrdersLoading(true);
    setOrders([]);
    try {
      const data = await fetchApi(`/admin/customers/${encodeURIComponent(customer.phone)}/orders`);
      setOrders(data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Chargement des commandes impossible.');
    } finally {
      setOrdersLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Clients</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Regroupes par numero de telephone. Le paiement a la livraison rend les refus couteux,
            ces compteurs vous aident a les reperer avant de lancer une fabrication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <label htmlFor="customer-search" className="sr-only">Rechercher un client</label>
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-pierre-deep" aria-hidden="true" />
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou telephone"
              className="h-11 w-56 bg-white border border-pierre-line rounded-xl pl-9 pr-3 text-xs text-ink focus:outline-none focus:border-terracotta"
            />
          </div>

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

      {error && (
        <div role="alert" className="bg-alerte-soft border border-alerte/30 text-alerte p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Audience tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'buyers', label: 'Clients', icon: Users, count: customers.length },
          { key: 'subscribers', label: 'Inscrits a l offre', icon: Mail, count: subsTotal },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-xs border transition-colors ${
              tab === key
                ? 'bg-ink text-ecru border-ink font-semibold'
                : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                tab === key ? 'bg-ecru/20 text-ecru' : 'bg-ambre-soft text-terracotta-deep'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'subscribers' ? (
        <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-pierre-line flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-serif font-bold text-ink">
                Inscrits a l offre de bienvenue
              </h2>
              <p className="text-[11px] text-pierre-deep mt-0.5">
                Des visiteurs interesses qui n ont pas encore commande. Ils ne
                sont pas comptes dans les statistiques clients.
              </p>
            </div>
            <button
              onClick={exportSubscribers}
              disabled={subscribers.length === 0}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 bg-ecru hover:bg-sable-soft text-ink text-xs font-semibold rounded-xl transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Exporter en CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[36rem]">
              <thead className="bg-ecru text-pierre-deep">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Adresse email</th>
                  <th scope="col" className="p-3 font-semibold">Origine</th>
                  <th scope="col" className="p-3 font-semibold">Inscrit le</th>
                  <th scope="col" className="p-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pierre-line text-ink-soft">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-pierre-deep">Chargement</td></tr>
                ) : subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-pierre-deep">
                      Aucune inscription pour le moment.
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-ecru/60">
                      <td className="p-3">
                        <a href={`mailto:${sub.email}`} className="text-ink hover:text-terracotta-deep">
                          {sub.email}
                        </a>
                      </td>
                      <td className="p-3 text-[11px]">
                        {sub.source === 'home_welcome_offer' ? 'Offre de bienvenue' : sub.source}
                      </td>
                      <td className="p-3 tabular-nums">
                        {new Date(sub.created_at).toLocaleDateString('fr-MA')}
                      </td>
                      <td className="p-3">
                        {sub.unsubscribed ? (
                          <span className="px-2 py-1 rounded text-[10px] font-semibold bg-ecru text-pierre-deep">
                            DESINSCRIT
                          </span>
                        ) : sub.converted ? (
                          <span className="px-2 py-1 rounded text-[10px] font-semibold bg-succes-soft text-succes">
                            A COMMANDE
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-[10px] font-semibold bg-ambre-soft text-terracotta-deep">
                            INTERESSE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-ecru text-pierre-deep">
              <tr>
                <th scope="col" className="p-3 font-semibold">Client</th>
                <th scope="col" className="p-3 font-semibold">Telephone</th>
                <th scope="col" className="p-3 font-semibold">Ville</th>
                <th scope="col" className="p-3 font-semibold">Commandes</th>
                <th scope="col" className="p-3 font-semibold">Livrees</th>
                <th scope="col" className="p-3 font-semibold">Refusees</th>
                <th scope="col" className="p-3 font-semibold">Total</th>
                <th scope="col" className="p-3 font-semibold">Evaluation</th>
                <th scope="col" className="p-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre-line text-ink-soft">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-pierre-deep">Chargement des clients</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-pierre-deep">Aucun client pour ce filtre.</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.phone} className="hover:bg-ecru/60">
                    <td className="p-3 font-semibold text-ink">{c.name}</td>
                    <td className="p-3">
                      <a href={`tel:${c.phone}`} className="hover:text-terracotta-deep">{c.phone}</a>
                    </td>
                    <td className="p-3">{c.city}</td>
                    <td className="p-3 tabular-nums font-semibold text-ink">{c.orders_count}</td>
                    <td className="p-3 tabular-nums text-succes">{c.delivered_count}</td>
                    <td className={`p-3 tabular-nums ${c.cancelled_count > 0 ? 'text-alerte font-semibold' : ''}`}>
                      {c.cancelled_count}
                    </td>
                    <td className="p-3 tabular-nums">{formatMad(c.total_spent_cents)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-semibold inline-flex items-center gap-1 ${RISK_STYLES[c.risk.level]}`}
                        title={c.risk.reasons.join(' · ')}
                      >
                        {c.risk.level === 'ok'
                          ? <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                          : <ShieldAlert className="w-3 h-3" aria-hidden="true" />}
                        {RISK_LABELS[c.risk.level]}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => openCustomer(c)}
                        className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                        aria-label={`Voir les commandes de ${c.name}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Customer detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-300 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSelected(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-title"
            className="relative ml-auto w-full max-w-lg bg-ecru border-l border-pierre-line h-full overflow-y-auto"
          >
            <div className="p-5 border-b border-pierre-line bg-white flex items-start justify-between gap-4 sticky top-0">
              <div>
                <h2 id="customer-title" className="font-serif font-bold text-ink text-lg">
                  {selected.name}
                </h2>
                <p className="mt-1.5 text-xs text-pierre-deep flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    {selected.phone}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {selected.city}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-pierre-deep hover:text-ink shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Assessment */}
              <div className={`p-4 rounded-2xl ${RISK_STYLES[selected.risk.level]}`}>
                <p className="font-semibold text-sm flex items-center gap-2">
                  {selected.risk.level === 'ok'
                    ? <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    : <ShieldAlert className="w-4 h-4" aria-hidden="true" />}
                  {RISK_LABELS[selected.risk.level]}
                </p>
                {selected.risk.reasons.length > 0 ? (
                  <ul className="mt-2.5 space-y-1 text-xs">
                    {selected.risk.reasons.map((r: string) => <li key={r}>{r}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs">
                    Pas encore assez d historique pour se prononcer.
                  </p>
                )}
              </div>

              {/* Counters */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Commandes', selected.orders_count],
                  ['Livrees', selected.delivered_count],
                  ['Refusees', selected.cancelled_count],
                  ['En attente', selected.pending_count],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-white border border-pierre-line rounded-xl p-3">
                    <dt className="text-[10px] text-pierre-deep">{label}</dt>
                    <dd className="mt-1 text-lg font-serif font-bold text-ink tabular-nums">{value as number}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-xs text-pierre-deep">
                Total commande {formatMad(selected.total_spent_cents)} depuis le{' '}
                {new Date(selected.first_order_at).toLocaleDateString('fr-MA')}.
              </p>

              {/* Orders */}
              <div>
                <h3 className="font-serif font-bold text-ink text-sm">Historique des commandes</h3>
                {ordersLoading ? (
                  <p className="mt-4 text-xs text-pierre-deep">Chargement</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {orders.map((o) => (
                      <li key={o.id} className="bg-white border border-pierre-line rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono font-semibold text-terracotta-deep text-xs">
                              {o.order_number}
                            </p>
                            <p className="text-[11px] text-pierre-deep mt-1">
                              {new Date(o.created_at).toLocaleDateString('fr-MA')} · {o.city}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-ink text-xs tabular-nums">
                              {formatMad(o.total_cents)}
                            </p>
                            <p className="text-[10px] text-pierre-deep mt-1">
                              {STATUS_LABELS[o.status] ?? o.status}
                            </p>
                          </div>
                        </div>

                        {o.items?.length > 0 && (
                          <ul className="mt-3 pt-3 border-t border-pierre-line space-y-1 text-[11px] text-pierre-deep">
                            {o.items.map((item: any) => (
                              <li key={item.id}>
                                {item.snapshotted_product_name} x{item.quantity}
                                {item.config_text && (
                                  <span className="text-terracotta-deep"> , grave {item.config_text}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
