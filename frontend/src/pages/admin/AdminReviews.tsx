import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Loader2, Search, Check, X, Eye, Trash2, AlertTriangle,
  BadgeCheck, Phone, Mail, Star
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { Stars } from '../../components/Stars';

const STATUS_TABS = [
  { value: 'pending', label: 'À traiter' },
  { value: 'published', label: 'Publiés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: '', label: 'Tous' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-ambre-soft text-terracotta-deep',
  published: 'bg-succes-soft text-succes',
  rejected: 'bg-alerte-soft text-alerte',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'À traiter',
  published: 'Publié',
  rejected: 'Rejeté',
};

export const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (tab) params.set('status', tab);
      if (search.trim()) params.set('search', search.trim());
      const data = await fetchApi(`/admin/reviews?${params}`);
      setReviews(data?.items ?? []);

      // The pending badge has to reflect the whole queue, not the current tab
      const all = await fetchApi('/admin/reviews?limit=200');
      const tally: Record<string, number> = {};
      (all?.items ?? []).forEach((r: any) => {
        tally[r.status] = (tally[r.status] ?? 0) + 1;
      });
      setCounts(tally);
    } catch (err: any) {
      setError(err?.message || 'Chargement des avis impossible.');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const moderate = async (review: any, status: string, note?: string) => {
    setBusyId(review.id);
    setError('');
    try {
      await fetchApi(`/admin/reviews/${review.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, staff_note: note ?? null }),
      });
      flash(
        status === 'published'
          ? `Avis de ${review.author_name} publié.`
          : status === 'rejected'
            ? `Avis de ${review.author_name} rejeté, il reste dans le journal.`
            : 'Avis remis en attente.'
      );
      if (detail?.id === review.id) setDetail(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Modération impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (review: any) => {
    const ok = window.confirm(
      [
        `Supprimer définitivement l avis de ${review.author_name} ?`,
        '',
        'Rejeter est presque toujours préférable: cela le retire du site tout',
        'en gardant la trace pour le journal d audit.',
      ].join('\n')
    );
    if (!ok) return;

    setBusyId(review.id);
    try {
      await fetchApi(`/admin/reviews/${review.id}`, { method: 'DELETE' });
      flash('Avis supprimé.');
      if (detail?.id === review.id) setDetail(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Avis clients</h1>
          <p className="text-xs text-pierre-deep mt-1 max-w-xl leading-relaxed">
            Les notes de 4 et 5 sont publiées automatiquement. Celles de 3 et
            moins arrivent ici pour lecture: un avis bas signale souvent un
            problème de service encore réparable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <label htmlFor="review-search" className="sr-only">Rechercher un avis</label>
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-pierre-deep" aria-hidden="true" />
            <input
              id="review-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, texte, commande"
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
      {notice && (
        <div role="status" className="bg-succes-soft border border-succes/30 text-succes p-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value || 'all'}
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-xs border transition-colors ${
              tab === t.value
                ? 'bg-ink text-ecru border-ink font-semibold'
                : 'bg-white text-ink-soft border-pierre-line hover:border-ambre'
            }`}
          >
            {t.label}
            {t.value && counts[t.value] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                tab === t.value ? 'bg-ecru/20 text-ecru' : 'bg-ambre-soft text-terracotta-deep'
              }`}>
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="bg-white border border-pierre-line rounded-2xl p-10 text-center text-sm text-pierre-deep">
          Chargement des avis
        </p>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-pierre-line rounded-2xl p-12 text-center">
          <Star className="w-7 h-7 text-pierre-line mx-auto" aria-hidden="true" />
          <p className="mt-3 text-sm text-ink-soft">
            {tab === 'pending'
              ? 'Rien à traiter. Tous les avis ont été relus.'
              : 'Aucun avis pour ce filtre.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="bg-white border border-pierre-line rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars rating={r.rating} />
                    <span className={`px-2 py-1 rounded text-[10px] font-semibold ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]?.toUpperCase()}
                    </span>
                    {r.verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-succes bg-succes-soft px-2 py-1 rounded">
                        <BadgeCheck className="w-3 h-3" aria-hidden="true" />
                        Achat vérifié
                      </span>
                    )}
                  </div>

                  {r.title && (
                    <p className="mt-2.5 font-serif font-bold text-ink text-sm">{r.title}</p>
                  )}
                  <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{r.body}</p>

                  <p className="mt-3 text-[11px] text-pierre-deep">
                    {r.author_name}
                    {r.author_city && `, ${r.author_city}`}
                    {' · '}
                    {new Date(r.created_at).toLocaleDateString('fr-MA')}
                    {r.product_name && ` · ${r.product_name}`}
                  </p>

                  {/* Why it landed where it did */}
                  {r.routing_reason && r.status === 'pending' && (
                    <p className="mt-2.5 inline-flex items-start gap-1.5 text-[11px] text-terracotta-deep bg-ambre-soft px-2.5 py-1.5 rounded-lg">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
                      {r.routing_reason}
                    </p>
                  )}

                  {/* Contact, so staff can call before deciding */}
                  {(r.author_phone || r.author_email || r.order_number) && (
                    <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-pierre-deep">
                      {r.author_phone && (
                        <a href={`tel:${r.author_phone}`} className="inline-flex items-center gap-1.5 hover:text-terracotta-deep">
                          <Phone className="w-3 h-3" aria-hidden="true" />
                          {r.author_phone}
                        </a>
                      )}
                      {r.author_email && (
                        <a href={`mailto:${r.author_email}`} className="inline-flex items-center gap-1.5 hover:text-terracotta-deep">
                          <Mail className="w-3 h-3" aria-hidden="true" />
                          {r.author_email}
                        </a>
                      )}
                      {r.order_number && <span className="font-mono">{r.order_number}</span>}
                    </p>
                  )}

                  {r.staff_note && (
                    <p className="mt-2.5 text-[11px] text-pierre-deep italic">
                      Note interne : {r.staff_note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {r.status !== 'published' && (
                    <button
                      onClick={() => moderate(r, 'published')}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 h-9 px-3 bg-succes-soft text-succes text-xs font-semibold rounded-lg hover:bg-succes hover:text-white transition-colors disabled:opacity-50"
                    >
                      {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Publier
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      onClick={() => moderate(r, 'rejected')}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 h-9 px-3 bg-ecru text-ink-soft text-xs font-semibold rounded-lg hover:bg-alerte-soft hover:text-alerte transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rejeter
                    </button>
                  )}
                  <button
                    onClick={() => setDetail(r)}
                    className="w-9 h-9 grid place-items-center text-pierre-deep hover:text-terracotta-deep rounded-lg"
                    aria-label={`Voir le detail de l avis de ${r.author_name}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="w-9 h-9 grid place-items-center text-pierre-deep hover:text-alerte rounded-lg"
                    aria-label={`Supprimer l avis de ${r.author_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Detail with a staff note */}
      {detail && (
        <div className="fixed inset-0 bg-ink/40 z-300 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Avis de ${detail.author_name}`}
            className="bg-white border border-pierre-line rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5 border-b border-pierre-line flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-serif font-bold text-ink">Avis de {detail.author_name}</h2>
              <button
                onClick={() => setDetail(null)}
                className="w-9 h-9 grid place-items-center text-pierre-deep hover:text-ink"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Stars rating={detail.rating} size="md" />
              {detail.title && <p className="font-serif font-bold text-ink">{detail.title}</p>}
              <p className="text-sm text-ink-soft leading-relaxed">{detail.body}</p>

              <label className="block">
                <span className="text-xs font-semibold text-ink">Note interne</span>
                <textarea
                  rows={3}
                  defaultValue={detail.staff_note ?? ''}
                  id="staff-note"
                  placeholder="Client rappele, probleme de livraison resolu."
                  className="admin-input mt-1.5"
                />
                <span className="text-[11px] text-pierre-deep mt-1 block">
                  Visible uniquement dans l administration.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-4 border-t border-pierre-line">
                <button
                  onClick={() => {
                    const note = (document.getElementById('staff-note') as HTMLTextAreaElement)?.value;
                    moderate(detail, 'rejected', note);
                  }}
                  className="bg-ecru hover:bg-alerte-soft hover:text-alerte text-ink text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Rejeter
                </button>
                <button
                  onClick={() => {
                    const note = (document.getElementById('staff-note') as HTMLTextAreaElement)?.value;
                    moderate(detail, 'published', note);
                  }}
                  className="bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Publier cet avis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
