import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Pencil, Loader2, RefreshCw, Check, ExternalLink
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { CLUSTERS } from '../../lib/seoStrategy';
import { AdminBlogEditor } from './AdminBlogEditor';

const emptyForm = {
  id: '',
  title: '',
  slug: '',
  content: '',
  cluster_id: CLUSTERS[0].id,
  status: 'published',
  keywords: '',
  excerpt: '',
  banner_url: '',
  banner_alt: '',
};

export const AdminArticles: React.FC = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<typeof emptyForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi('/admin/articles?limit=100');
      setArticles(data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Chargement des guides impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  };

  /**
   * Asks the API whether these keywords are already claimed by another guide.
   *
   * Two articles targeting one query split the signal between two of our own
   * URLs. Surfacing that at writing time is far cheaper than discovering it in
   * Search Console three months later.
   */




  const handleDelete = async (article: any) => {
    if (!window.confirm(`Supprimer le guide "${article.title}" ?`)) return;
    setError('');
    try {
      await fetchApi(`/admin/articles/${article.id}`, { method: 'DELETE' });
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      flash('Guide supprime.');
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    }
  };

  // The editor takes over the whole panel rather than opening in a dialog:
  // part D asks for a two panel layout with an import column beside the field
  // editor, which does not fit a modal at any useful width.
  if (editor) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-serif font-bold text-ink">
            {editor.id ? `Modifier : ${editor.title || editor.slug}` : 'Nouveau guide'}
          </h1>
        </div>

        <AdminBlogEditor
          key={editor.id || 'new'}
          initial={editor}
          articleId={editor.id || null}
          onSaved={() => { setEditor(null); load(); }}
          onCancel={() => setEditor(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Guides</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Les articles publies alimentent la page Guides et les liens internes vers les collections.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setEditor({ ...emptyForm })}
            className="bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nouveau guide
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
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-ecru text-pierre-deep">
              <tr>
                <th scope="col" className="p-3 font-semibold">Titre</th>
                <th scope="col" className="p-3 font-semibold">Adresse</th>
                <th scope="col" className="p-3 font-semibold">Collection liee</th>
                <th scope="col" className="p-3 font-semibold">Statut</th>
                <th scope="col" className="p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre-line text-ink-soft">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-pierre-deep">Chargement des guides</td></tr>
              ) : articles.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-pierre-deep">Aucun guide pour le moment.</td></tr>
              ) : (
                articles.map((a) => {
                  const cluster = CLUSTERS.find((c) => c.id === a.cluster_id);
                  return (
                    <tr key={a.id} className="hover:bg-ecru/60">
                      <td className="p-3 font-semibold text-ink">{a.title}</td>
                      <td className="p-3 font-mono text-pierre-deep">{a.slug}</td>
                      <td className="p-3">{cluster?.shortLabel ?? a.cluster_id}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-[10px] uppercase font-semibold ${
                            a.status === 'published' ? 'bg-succes-soft text-succes' : 'bg-sable text-ink'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={`/guides/${a.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                            aria-label={`Ouvrir le guide ${a.title}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => setEditor({ ...a })}
                            className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                            aria-label={`Modifier ${a.title}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(a)}
                            className="p-1.5 text-pierre-deep hover:text-alerte"
                            aria-label={`Supprimer ${a.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
