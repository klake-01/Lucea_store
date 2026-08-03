import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Pencil, X, Loader2, RefreshCw, Check, Search, Wand2, Copy
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatMad } from '../../lib/format';

type DiscountType = 'percentage' | 'fixed_cents' | 'free_shipping';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-succes-soft text-succes',
  scheduled: 'bg-info-soft text-info',
  expired: 'bg-ecru text-pierre-deep',
  exhausted: 'bg-ecru text-pierre-deep',
  disabled: 'bg-alerte-soft text-alerte',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  scheduled: 'Programme',
  expired: 'Expire',
  exhausted: 'Epuise',
  disabled: 'Desactive',
};

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Pourcentage',
  fixed_cents: 'Montant fixe',
  free_shipping: 'Livraison offerte',
};

const emptyForm = {
  id: '',
  code: '',
  code_prefix: '',
  description: '',
  discount_type: 'percentage' as DiscountType,
  value: '10',
  min_order_cents: '0',
  max_discount_cents: '',
  valid_from: '',
  valid_until: '',
  usage_limit: '100',
  active_status: true,
};

/** Renders what a code is worth in one line, the way staff describe it. */
const describeValue = (v: any) => {
  if (v.discount_type === 'free_shipping') return 'Livraison offerte';
  if (v.discount_type === 'percentage') {
    const cap = v.max_discount_cents ? `, max ${formatMad(v.max_discount_cents)}` : '';
    return `${v.value} pour cent${cap}`;
  }
  return formatMad(v.value);
};

const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : '');

export const AdminCoupons: React.FC = () => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<typeof emptyForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const data = await fetchApi(`/admin/vouchers${query}`);
      setVouchers(data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Chargement des codes impossible.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  };

  const suggestCode = async () => {
    if (!editor) return;
    try {
      const res = await fetchApi(
        `/admin/vouchers/suggest-code?prefix=${encodeURIComponent(editor.code_prefix)}`
      );
      setEditor({ ...editor, code: res.code });
    } catch {
      /* the server will generate one on save anyway */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;

    setSaving(true);
    setError('');

    // Money is entered in dirhams and stored in minor units
    const payload: Record<string, unknown> = {
      description: editor.description.trim() || null,
      discount_type: editor.discount_type,
      value:
        editor.discount_type === 'percentage'
          ? Number(editor.value)
          : editor.discount_type === 'fixed_cents'
            ? Math.round(Number(editor.value) * 100)
            : 0,
      min_order_cents: Math.round(Number(editor.min_order_cents || 0) * 100),
      max_discount_cents: editor.max_discount_cents
        ? Math.round(Number(editor.max_discount_cents) * 100)
        : null,
      valid_from: editor.valid_from ? new Date(editor.valid_from).toISOString() : null,
      valid_until: editor.valid_until ? new Date(editor.valid_until).toISOString() : null,
      usage_limit: Number(editor.usage_limit),
      active_status: editor.active_status,
    };

    try {
      if (editor.id) {
        await fetchApi(`/admin/vouchers/${editor.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        flash('Code mis a jour.');
      } else {
        const created = await fetchApi('/admin/vouchers', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            code: editor.code.trim() || null,
            code_prefix: editor.code_prefix.trim() || null,
          }),
        });
        flash(`Code ${created.code} cree.`);
      }
      setEditor(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (voucher: any) => {
    if (!window.confirm(`Supprimer definitivement le code ${voucher.code} ?`)) return;
    setError('');
    try {
      await fetchApi(`/admin/vouchers/${voucher.id}`, { method: 'DELETE' });
      setVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
      flash('Code supprime.');
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      flash(`${code} copie dans le presse papier.`);
    } catch {
      setError('Copie impossible, selectionnez le code manuellement.');
    }
  };

  const openEdit = (v: any) => setEditor({
    id: v.id,
    code: v.code,
    code_prefix: '',
    description: v.description || '',
    discount_type: v.discount_type,
    value: v.discount_type === 'fixed_cents' ? String(v.value / 100) : String(v.value),
    min_order_cents: String((v.min_order_cents || 0) / 100),
    max_discount_cents: v.max_discount_cents ? String(v.max_discount_cents / 100) : '',
    valid_from: toLocalInput(v.valid_from),
    valid_until: toLocalInput(v.valid_until),
    usage_limit: String(v.usage_limit),
    active_status: v.active_status,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Codes promo</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Generez un code, fixez la remise, le minimum de commande, le plafond et la periode de validite.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <label htmlFor="voucher-search" className="sr-only">Rechercher un code</label>
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-pierre-deep" aria-hidden="true" />
            <input
              id="voucher-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code ou description"
              className="h-11 w-52 bg-white border border-pierre-line rounded-xl pl-9 pr-3 text-xs text-ink focus:outline-none focus:border-terracotta"
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

          <button
            onClick={() => setEditor({ ...emptyForm })}
            className="h-11 bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-4 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nouveau code
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-alerte-soft border border-alerte/30 text-alerte p-4 rounded-xl text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="bg-succes-soft border border-succes/30 text-succes p-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4" aria-hidden="true" />
          {notice}
        </div>
      )}

      <div className="bg-white border border-pierre-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[860px]">
            <thead className="bg-ecru text-pierre-deep">
              <tr>
                <th scope="col" className="p-3 font-semibold">Code</th>
                <th scope="col" className="p-3 font-semibold">Remise</th>
                <th scope="col" className="p-3 font-semibold">Minimum</th>
                <th scope="col" className="p-3 font-semibold">Validite</th>
                <th scope="col" className="p-3 font-semibold">Utilisations</th>
                <th scope="col" className="p-3 font-semibold">Statut</th>
                <th scope="col" className="p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre-line text-ink-soft">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-pierre-deep">Chargement des codes</td></tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-pierre-deep">
                    Aucun code pour le moment. Creez en un pour lancer une promotion.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-ecru/60 align-top">
                    <td className="p-3">
                      <button
                        onClick={() => copyCode(v.code)}
                        className="font-mono font-bold text-terracotta-deep hover:text-terracotta inline-flex items-center gap-1.5"
                        title="Copier le code"
                      >
                        {v.code}
                        <Copy className="w-3 h-3 opacity-60" aria-hidden="true" />
                      </button>
                      {v.description && (
                        <span className="block text-[11px] text-pierre-deep mt-1">{v.description}</span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-ink">{describeValue(v)}</td>
                    <td className="p-3 tabular-nums">
                      {v.min_order_cents ? formatMad(v.min_order_cents) : 'aucun'}
                    </td>
                    <td className="p-3 text-[11px]">
                      {v.valid_until
                        ? `jusqu au ${new Date(v.valid_until).toLocaleDateString('fr-MA')}`
                        : 'sans limite'}
                    </td>
                    <td className="p-3 tabular-nums">
                      {v.usage_count} sur {v.usage_limit}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold ${STATUS_STYLES[v.status] ?? 'bg-ecru text-pierre-deep'}`}>
                        {(STATUS_LABELS[v.status] ?? v.status).toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                          aria-label={`Modifier ${v.code}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 text-pierre-deep hover:text-alerte"
                          aria-label={`Supprimer ${v.code}`}
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

      {editor && (
        <div className="fixed inset-0 bg-ink/40 z-300 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editor.id ? 'Modifier le code' : 'Nouveau code promo'}
            className="bg-white border border-pierre-line rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5 border-b border-pierre-line flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-serif font-bold text-ink">
                {editor.id ? `Modifier ${editor.code}` : 'Nouveau code promo'}
              </h2>
              <button
                onClick={() => setEditor(null)}
                className="p-1.5 text-pierre-deep hover:text-ink"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {!editor.id && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-ink block mb-1.5">Prefixe</span>
                      <input
                        type="text"
                        value={editor.code_prefix}
                        onChange={(e) => setEditor({ ...editor, code_prefix: e.target.value.toUpperCase() })}
                        placeholder="SOLDES"
                        className="admin-input font-mono"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-ink block mb-1.5">Code</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editor.code}
                          onChange={(e) => setEditor({ ...editor, code: e.target.value.toUpperCase() })}
                          placeholder="Genere automatiquement"
                          className="admin-input font-mono"
                        />
                        <button
                          type="button"
                          onClick={suggestCode}
                          className="shrink-0 w-11 grid place-items-center bg-sable hover:bg-sable-soft rounded-xl text-ink"
                          aria-label="Generer un code"
                          title="Generer un code"
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                      </div>
                    </label>
                  </div>
                  <p className="text-[11px] text-pierre-deep">
                    Laissez le code vide pour le generer. Les caracteres ambigus comme O, 0, I et 1 sont exclus.
                  </p>
                </>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-ink block mb-1.5">Description interne</span>
                <input
                  type="text"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder="Campagne Instagram octobre"
                  className="admin-input"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink block mb-1.5">Type de remise</span>
                  <select
                    value={editor.discount_type}
                    onChange={(e) => setEditor({ ...editor, discount_type: e.target.value as DiscountType })}
                    className="admin-input"
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                {editor.discount_type !== 'free_shipping' && (
                  <label className="block">
                    <span className="text-xs font-semibold text-ink block mb-1.5">
                      {editor.discount_type === 'percentage' ? 'Pourcentage' : 'Montant en dirhams'}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={editor.discount_type === 'percentage' ? 90 : undefined}
                      required
                      value={editor.value}
                      onChange={(e) => setEditor({ ...editor, value: e.target.value })}
                      className="admin-input tabular-nums"
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink block mb-1.5">Minimum de commande, dirhams</span>
                  <input
                    type="number"
                    min="0"
                    value={editor.min_order_cents}
                    onChange={(e) => setEditor({ ...editor, min_order_cents: e.target.value })}
                    className="admin-input tabular-nums"
                  />
                </label>

                {editor.discount_type === 'percentage' && (
                  <label className="block">
                    <span className="text-xs font-semibold text-ink block mb-1.5">Plafond de remise, dirhams</span>
                    <input
                      type="number"
                      min="0"
                      value={editor.max_discount_cents}
                      onChange={(e) => setEditor({ ...editor, max_discount_cents: e.target.value })}
                      placeholder="sans plafond"
                      className="admin-input tabular-nums"
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink block mb-1.5">Debut de validite</span>
                  <input
                    type="datetime-local"
                    value={editor.valid_from}
                    onChange={(e) => setEditor({ ...editor, valid_from: e.target.value })}
                    className="admin-input"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-ink block mb-1.5">Fin de validite</span>
                  <input
                    type="datetime-local"
                    value={editor.valid_until}
                    onChange={(e) => setEditor({ ...editor, valid_until: e.target.value })}
                    className="admin-input"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="block">
                  <span className="text-xs font-semibold text-ink block mb-1.5">Limite d utilisation</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editor.usage_limit}
                    onChange={(e) => setEditor({ ...editor, usage_limit: e.target.value })}
                    className="admin-input tabular-nums"
                  />
                </label>

                <label className="flex items-center gap-2.5 h-11 px-1">
                  <input
                    type="checkbox"
                    checked={editor.active_status}
                    onChange={(e) => setEditor({ ...editor, active_status: e.target.checked })}
                    className="w-4 h-4 accent-[#d98e4a]"
                  />
                  <span className="text-xs font-semibold text-ink">Code actif</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-pierre-line">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="bg-ecru hover:bg-sable-soft text-ink text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  {editor.id ? 'Enregistrer' : 'Creer le code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
