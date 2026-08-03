import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Loader2, Eye, X, Phone, MapPin, Package, Search, Trash2, AlertTriangle,
  FileDown
} from 'lucide-react';
import { fetchApi, getStoredToken } from '../../lib/api';
import { formatMad } from '../../lib/format';

const STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmee' },
  { value: 'dispatched', label: 'Expediee' },
  { value: 'delivered', label: 'Livree' },
  { value: 'cancelled', label: 'Annulee' },
  { value: 'returned', label: 'Retournee' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-ambre-soft text-terracotta-deep',
  confirmed: 'bg-info-soft text-info',
  dispatched: 'bg-sable text-ink',
  delivered: 'bg-succes-soft text-succes',
  cancelled: 'bg-alerte-soft text-alerte',
  returned: 'bg-alerte-soft text-alerte',
};

const statusLabel = (value: string) =>
  STATUSES.find((s) => s.value === value)?.label ?? value;

export const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await fetchApi(`/admin/orders${query}`);
      setOrders(data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Chargement des commandes impossible.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per key
    const timer = setTimeout(loadOrders, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadOrders, search]);

  const handleDelete = async (order: any) => {
    const confirmed = window.confirm(
      [
        `Supprimer definitivement la commande ${order.order_number} ?`,
        '',
        'Les articles retournent en stock, sauf si la commande est deja livree.',
        'Cette action est irreversible et tracee dans le journal d audit.',
      ].join('\n')
    );
    if (!confirmed) return;

    setError('');
    try {
      const result = await fetchApi(`/admin/orders/${order.id}`, { method: 'DELETE' });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      if (detail?.id === order.id) setDetail(null);
      const restored = result?.stock_restored?.length
        ? ` Stock restaure: ${result.stock_restored.map((r: any) => `${r.sku} +${r.quantity}`).join(', ')}.`
        : '';
      setNotice(`Commande ${order.order_number} supprimee.${restored}`);
      setTimeout(() => setNotice(''), 5000);
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    }
  };

  /**
   * Downloads the branded confirmation.
   *
   * Fetched rather than linked because the endpoint needs the bearer token,
   * which a plain anchor cannot send. The blob is released straight after the
   * click so the tab does not accumulate object URLs.
   */
  const handleDownloadPdf = async (order: any) => {
    setDownloadingPdf(order.id);
    setError('');
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/v1/admin/orders/${order.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Generation du PDF echouee (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LUCEA-${order.order_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Telechargement du PDF impossible.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    setError('');
    try {
      const updated = await fetchApi(`/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
          notes: `Statut passe a ${statusLabel(newStatus)} depuis l administration`,
        }),
      });

      // Patch the row in place so the table does not jump back to the top
      setOrders((prev) =>
        statusFilter && statusFilter !== newStatus
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
      );
      if (detail?.id === orderId) setDetail(updated);
    } catch (err: any) {
      setError(err?.message || 'Mise a jour du statut impossible.');
      await loadOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Commandes</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Filtrez, consultez le detail et faites avancer chaque commande.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <label htmlFor="order-search" className="sr-only">
              Rechercher par numero, nom ou telephone
            </label>
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-pierre-deep" aria-hidden="true" />
            <input
              id="order-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Numero, nom ou telephone"
              className="h-11 w-56 bg-white border border-pierre-line rounded-xl pl-9 pr-3 text-xs text-ink focus:outline-none focus:border-terracotta"
            />
          </div>

          <label htmlFor="order-filter" className="sr-only">Filtrer par statut</label>
          <select
            id="order-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-pierre-line rounded-xl text-xs p-2.5 text-ink focus:outline-none focus:border-terracotta"
          >
            <option value="">Toutes les commandes</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-2 bg-white border border-pierre-line hover:border-ambre text-ink text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-alerte-soft border border-alerte/30 text-alerte p-4 rounded-xl text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="bg-succes-soft border border-succes/30 text-succes p-3 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {notice}
        </div>
      )}

      <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[880px]">
            <thead className="bg-ecru text-pierre-deep">
              <tr>
                <th scope="col" className="p-3 font-semibold">Numero</th>
                <th scope="col" className="p-3 font-semibold">Client</th>
                <th scope="col" className="p-3 font-semibold">Telephone</th>
                <th scope="col" className="p-3 font-semibold">Ville</th>
                <th scope="col" className="p-3 font-semibold">Montant</th>
                <th scope="col" className="p-3 font-semibold">Statut</th>
                <th scope="col" className="p-3 font-semibold">Faire avancer</th>
                <th scope="col" className="p-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre-line text-ink-soft">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-pierre-deep">
                    Chargement des commandes
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-pierre-deep">
                    {search
                      ? `Aucune commande ne correspond a "${search}".`
                      : 'Aucune commande pour ce filtre.'}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-ecru/60">
                    <td className="p-3 font-mono font-semibold text-terracotta-deep">{o.order_number}</td>
                    <td className="p-3 font-medium text-ink">{o.name}</td>
                    <td className="p-3">
                      <a href={`tel:${o.phone}`} className="hover:text-terracotta-deep">{o.phone}</a>
                    </td>
                    <td className="p-3">{o.city}</td>
                    <td className="p-3 font-bold text-ink tabular-nums">{formatMad(o.total_cents)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold ${STATUS_STYLES[o.status] ?? 'bg-ecru text-pierre-deep'}`}>
                        {statusLabel(o.status).toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <label htmlFor={`status-${o.id}`} className="sr-only">
                        Changer le statut de {o.order_number}
                      </label>
                      <select
                        id={`status-${o.id}`}
                        value={o.status}
                        disabled={updatingId === o.id}
                        onChange={(e) => handleStatusUpdate(o.id, e.target.value)}
                        className="bg-ecru border border-pierre-line text-[11px] rounded-lg p-1.5 text-ink focus:outline-none focus:border-terracotta disabled:opacity-50"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDetail(o)}
                          className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                          aria-label={`Voir le detail de ${o.order_number}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(o)}
                          disabled={downloadingPdf === o.id}
                          className="p-1.5 text-pierre-deep hover:text-terracotta-deep disabled:opacity-40"
                          aria-label={`Telecharger la confirmation PDF de ${o.order_number}`}
                          title="Confirmation PDF"
                        >
                          {downloadingPdf === o.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <FileDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(o)}
                          className="p-1.5 text-pierre-deep hover:text-alerte"
                          aria-label={`Supprimer la commande ${o.order_number}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDetail(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            className="relative ml-auto w-full max-w-md bg-ecru border-l border-pierre-line h-full overflow-y-auto"
          >
            <div className="p-4 border-b border-pierre-line bg-white flex items-center justify-between sticky top-0">
              <h2 id="order-detail-title" className="font-serif font-bold text-ink">
                {detail.order_number}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(detail)}
                  disabled={downloadingPdf === detail.id}
                  className="inline-flex items-center gap-1.5 bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-[11px] font-bold px-3 h-9 rounded-lg transition-colors disabled:opacity-50"
                  title="Confirmation PDF a envoyer au client"
                >
                  {downloadingPdf === detail.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    : <FileDown className="w-3.5 h-3.5" aria-hidden="true" />}
                  Confirmation PDF
                </button>
                <button
                  onClick={() => setDetail(null)}
                  className="p-1.5 text-pierre-deep hover:text-ink"
                  aria-label="Fermer le detail"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="bg-white border border-pierre-line rounded-xl p-4 space-y-2">
                <p className="font-semibold text-ink text-sm">{detail.name}</p>
                <p className="flex items-center gap-2 text-ink-soft">
                  <Phone className="w-3.5 h-3.5 text-terracotta" aria-hidden="true" />
                  <a href={`tel:${detail.phone}`} className="hover:text-terracotta-deep">{detail.phone}</a>
                </p>
                <p className="flex items-start gap-2 text-ink-soft">
                  <MapPin className="w-3.5 h-3.5 text-terracotta flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {detail.address_line}, {detail.city}
                </p>
              </div>

              <div className="bg-white border border-pierre-line rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-ink flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-terracotta" aria-hidden="true" />
                  Articles
                </h3>
                {(detail.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex justify-between gap-3 border-b border-pierre-line pb-2 last:border-0">
                    <div>
                      <span className="text-ink block">{item.snapshotted_product_name}</span>
                      <span className="text-pierre-deep">
                        {item.snapshotted_sku} , quantite {item.quantity}
                      </span>
                      {item.config_text && (
                        <span className="text-terracotta-deep block">
                          Gravure : {item.config_text}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-ink whitespace-nowrap">
                      {formatMad(item.snapshotted_price_cents * item.quantity)}
                    </span>
                  </div>
                ))}

                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-ink-soft">
                    <span>Sous total</span>
                    <span className="tabular-nums">{formatMad(detail.subtotal_cents)}</span>
                  </div>
                  {detail.discount_cents > 0 && (
                    <div className="flex justify-between text-succes">
                      <span>Remise</span>
                      <span className="tabular-nums">moins {formatMad(detail.discount_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-ink-soft">
                    <span>Livraison</span>
                    <span className="tabular-nums">{formatMad(detail.delivery_charge_cents)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink pt-1.5 border-t border-pierre-line text-sm">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMad(detail.total_cents)}</span>
                  </div>
                </div>
              </div>

              {detail.status_history?.length > 0 && (
                <div className="bg-white border border-pierre-line rounded-xl p-4 space-y-2">
                  <h3 className="font-semibold text-ink">Historique</h3>
                  <ol className="space-y-2">
                    {detail.status_history.map((h: any) => (
                      <li key={h.id} className="flex justify-between gap-3">
                        <span className="text-ink-soft">
                          {statusLabel(h.status)}
                          {h.notes && <span className="block text-pierre-deep">{h.notes}</span>}
                        </span>
                        <span className="text-pierre-deep whitespace-nowrap">
                          {new Date(h.created_at).toLocaleDateString('fr-MA')}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
