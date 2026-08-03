import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Loader2, ShieldAlert } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const ACTION_LABELS: Record<string, string> = {
  CREATE_PRODUCT: 'Produit cree',
  UPDATE_PRODUCT: 'Produit modifie',
  DELETE_PRODUCT: 'Produit supprime',
  CREATE_VARIANT: 'Variante creee',
  UPDATE_VARIANT: 'Variante modifiee',
  DELETE_VARIANT: 'Variante supprimee',
  ADD_PRODUCT_IMAGE: 'Image ajoutee',
  DELETE_PRODUCT_IMAGE: 'Image supprimee',
  UPDATE_ORDER_STATUS: 'Statut de commande modifie',
  CREATE_ARTICLE: 'Guide cree',
  UPDATE_ARTICLE: 'Guide modifie',
  DELETE_ARTICLE: 'Guide supprime',
};

/** Renders the before and after snapshots without dumping raw JSON braces. */
const summarise = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value as Record<string, unknown>)
    .map(([key, val]) => `${key} ${String(val)}`)
    .join(', ');
};

export const AdminAuditLog: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role_name === 'admin';

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi('/auth/admin/audit-log?limit=100');
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Chargement du journal impossible.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-terracotta mx-auto" aria-hidden="true" />
        <h1 className="text-xl font-serif font-bold text-ink">Acces reserve</h1>
        <p className="text-sm text-pierre-deep">
          Le journal d audit n est consultable que par un compte administrateur.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Journal d audit</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Historique en ecriture seule de toutes les actions du personnel sur le catalogue,
            les commandes et les guides.
          </p>
        </div>

        <button
          onClick={load}
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

      {error && (
        <div role="alert" className="bg-alerte-soft border border-alerte/30 text-alerte p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-ecru text-pierre-deep">
              <tr>
                <th scope="col" className="p-3 font-semibold">Horodatage</th>
                <th scope="col" className="p-3 font-semibold">Action</th>
                <th scope="col" className="p-3 font-semibold">Table</th>
                <th scope="col" className="p-3 font-semibold">Avant</th>
                <th scope="col" className="p-3 font-semibold">Apres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre-line text-ink-soft">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-pierre-deep">Chargement du journal</td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-pierre-deep">
                    Aucune action enregistree pour le moment. Les entrees apparaissent des
                    qu un membre du personnel modifie un produit, une commande ou un guide.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-ecru/60 align-top">
                    <td className="p-3 text-pierre-deep whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('fr-MA')}
                    </td>
                    <td className="p-3 font-semibold text-ink">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </td>
                    <td className="p-3 font-mono text-pierre-deep">{log.target_table}</td>
                    <td className="p-3 max-w-64 break-words">{summarise(log.before_value) || '.'}</td>
                    <td className="p-3 max-w-64 break-words">{summarise(log.after_value) || '.'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
