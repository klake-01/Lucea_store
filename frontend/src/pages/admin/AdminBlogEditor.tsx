import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, ClipboardPaste, Check, AlertTriangle, XCircle, Copy, Loader2,
  Plus, Trash2, FileJson, Eye, Globe, ShieldAlert, ImageUp,
} from 'lucide-react';
import { fetchApi, getStoredToken } from '../../lib/api';
import { CLUSTERS } from '../../lib/seoStrategy';

/**
 * The blog editor — `00-foundation/05-BLOG-SYSTEM.md` part D.
 *
 * Deliberately minimal and JSON-first: paste or upload one article object,
 * validate it, apply it to the form, edit, save. Part D.3 forbids three things
 * and this component honours all of them:
 *
 *   - no AI generation; the JSON is authored elsewhere
 *   - no hand-writing schema, canonical or meta, because all of it is derived
 *     from these fields on the server
 *   - no silent slug change on a published article; the backend writes the 301
 */

const TEMPLATE = {
  title: '',
  slug: '',
  target_keyword: '',
  seo_title: '',
  seo_meta_description: '',
  seo_keywords: ['', '', ''],
  category: '',
  cluster_id: CLUSTERS[0]?.id ?? '',
  tags: [],
  excerpt: '',
  banner_url: '',
  banner_alt: '',
  author: '',
  content: '<h2>Titre de section</h2><p>…</p>',
  content_images: [],
  faqs: [
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ],
  cta: { category: '', link: '', title: '', description: '' },
  status: 'draft',
};

type Draft = Record<string, any>;

const emptyDraft = (): Draft => JSON.parse(JSON.stringify(TEMPLATE));

/** Counter that turns amber then red as a field passes its target length. */
const Counter: React.FC<{ value: string; min?: number; max: number }> = ({ value, min, max }) => {
  const n = value.length;
  const over = n > max;
  const under = min !== undefined && n > 0 && n < min;
  return (
    <span
      className={`tabular-nums ${over ? 'text-alerte font-semibold' : under ? 'text-ambre-deep' : 'text-pierre-deep'}`}
    >
      {n}/{max}
    </span>
  );
};

const Field: React.FC<{
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="flex items-baseline justify-between gap-3 mb-1.5">
      <span className="text-[11px] font-semibold text-ink">
        {label}
        {required && <span className="text-alerte ml-0.5">*</span>}
      </span>
      {hint && <span className="text-[10px]">{hint}</span>}
    </span>
    {children}
  </label>
);

export const AdminBlogEditor: React.FC<{
  initial?: Draft | null;
  articleId?: string | null;
  onSaved: () => void;
  onCancel: () => void;
}> = ({ initial, articleId, onSaved, onCancel }) => {
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), ...(initial || {}) }));
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [conflicts, setConflicts] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  /* ------------------------------------------------ JSON import panel */

  const applyJson = (text: string) => {
    setError('');
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      setError(`JSON invalide : ${e.message}`);
      return;
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('Le JSON doit être un objet article.');
      return;
    }

    // The contract names the cover fields cover_image_*, this store's rows
    // call them banner_*. Accept either so a file written against the spec
    // imports without being edited by hand first.
    const mapped: Draft = { ...parsed };
    if (parsed.cover_image_url && !parsed.banner_url) mapped.banner_url = parsed.cover_image_url;
    if (parsed.cover_image_alt && !parsed.banner_alt) mapped.banner_alt = parsed.cover_image_alt;
    if (!mapped.cluster_id) {
      const guess = CLUSTERS.find(
        (c) => c.shortLabel.toLowerCase() === String(parsed.category || '').toLowerCase()
      );
      mapped.cluster_id = guess?.id ?? CLUSTERS[0].id;
    }

    setDraft({ ...emptyDraft(), ...mapped });
    setNotice('JSON appliqué au formulaire.');
    setTimeout(() => setNotice(''), 2500);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setRaw(text);
      applyJson(text);
    };
    reader.readAsText(file);
  };

  const copyTemplate = async () => {
    await navigator.clipboard.writeText(JSON.stringify(TEMPLATE, null, 2));
    setNotice('Modèle JSON copié.');
    setTimeout(() => setNotice(''), 2500);
  };

  /* ------------------------------------------------------- validation */

  const validate = async () => {
    setBusy(true);
    setError('');
    try {
      const query = articleId ? `?exclude_id=${encodeURIComponent(articleId)}` : '';
      const res = await fetchApi(`/admin/articles/validate${query}`, {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      setResult(res);
      await checkKeywords();
    } catch (e: any) {
      setError(e?.message || 'Validation impossible.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (publish: boolean) => {
    setBusy(true);
    setError('');
    try {
      const body = { ...draft, status: publish ? 'published' : draft.status || 'draft' };
      // The server re-validates whatever arrives, so a client that skipped the
      // Validate button still cannot persist a broken article.
      const saved = articleId
        ? await fetchApi(`/admin/articles/${articleId}`, { method: 'PUT', body: JSON.stringify(body) })
        : await fetchApi('/admin/articles', { method: 'POST', body: JSON.stringify(body) });
      setNotice(`Article ${publish ? 'publié' : 'enregistré'} : ${saved.slug}`);
      onSaved();
    } catch (e: any) {
      const detail = e?.detail || e?.body?.detail;
      if (detail?.errors) {
        setResult({ ok: false, errors: detail.errors, warnings: detail.warnings || [], stats: detail.stats });
        setError('Le serveur a refusé l article, voir les erreurs ci-dessous.');
      } else {
        setError(e?.message || 'Enregistrement impossible.');
      }
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------- E.1 anti-cannibalisation */

  /** Warns when another article already owns one of these keywords. One page
   *  owns one head term; a second page targeting it splits the authority
   *  instead of adding to it. */
  const checkKeywords = async () => {
    const words = [draft.target_keyword, ...(draft.seo_keywords || [])]
      .filter(Boolean)
      .join(', ');
    if (!words.trim()) {
      setConflicts(null);
      return;
    }
    try {
      const res = await fetchApi('/admin/articles/keyword-check', {
        method: 'POST',
        body: JSON.stringify({ keywords: words, exclude_article_id: articleId || null }),
      });
      setConflicts(res);
    } catch {
      setConflicts(null);
    }
  };

  /** Cover upload. The endpoint attaches the file to an existing row, so it is
   *  only offered once the article has been saved at least once. */
  const uploadBanner = async (file?: File) => {
    if (!file || !articleId) return;
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      if (draft.banner_alt) body.append('alt', draft.banner_alt);
      const token = getStoredToken();
      const res = await fetch(`/api/v1/admin/articles/${articleId}/banner`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || `Téléversement échoué (${res.status})`);
      }
      const updated = await res.json();
      set({ banner_url: updated.banner_url, banner_alt: updated.banner_alt || draft.banner_alt });
      setNotice('Couverture mise à jour.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e: any) {
      setError(e?.message || 'Téléversement impossible.');
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------------------------------ SERP preview */

  const serp = useMemo(() => {
    const title = draft.seo_title || draft.title || 'Titre de la page';
    const desc = draft.seo_meta_description || draft.excerpt || 'Meta description…';
    return {
      title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
      url: `luceamaroc.com › guides › ${draft.slug || 'slug'}`,
      desc: desc.length > 160 ? `${desc.slice(0, 157)}…` : desc,
    };
  }, [draft.seo_title, draft.title, draft.seo_meta_description, draft.excerpt, draft.slug]);

  const slugify = () =>
    set({
      slug: String(draft.title || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    });

  const listField = (key: string) => (draft[key] || []) as any[];

  return (
    <div className="space-y-5">
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

      <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-5 items-start">
        {/* ---------------------------------------------- left: import */}
        <div className="space-y-5 lg:sticky lg:top-4">
          <section className="bg-white border border-pierre-line rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-serif font-bold text-ink">
              <FileJson className="w-4 h-4 text-terracotta" aria-hidden="true" />
              Importer un article JSON
            </h2>
            <p className="text-[11px] text-pierre-deep mt-1">
              Un article est un seul objet JSON. Collez le, validez, appliquez.
            </p>

            <textarea
              rows={8}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='{ "title": "…", "slug": "…", … }'
              className="admin-input font-mono text-[11px] mt-4"
              aria-label="Coller le JSON de l article"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => applyJson(raw)}
                disabled={!raw.trim()}
                className="inline-flex items-center justify-center gap-1.5 h-11 bg-ink text-ecru text-xs font-semibold rounded-xl disabled:opacity-40"
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                Appliquer
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 h-11 bg-ecru hover:bg-sable-soft text-ink text-xs font-semibold rounded-xl border border-pierre-line transition-colors"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Fichier .json
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={copyTemplate}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 h-11 bg-white hover:bg-ecru text-ink-soft text-xs font-semibold rounded-xl border border-pierre-line transition-colors"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Copier le modèle vide
              </button>
            </div>

            <button
              onClick={validate}
              disabled={busy}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
              Valider
            </button>
          </section>

          {result && (
            <section
              aria-live="polite"
              className={`border rounded-2xl p-5 ${result.ok ? 'bg-succes-soft border-succes/30' : 'bg-alerte-soft border-alerte/30'}`}
            >
              <p className={`flex items-center gap-2 text-xs font-bold ${result.ok ? 'text-succes' : 'text-alerte'}`}>
                {result.ok ? <Check className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                {result.ok ? 'Article valide' : `${result.errors.length} erreur(s) bloquante(s)`}
              </p>

              {result.errors?.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {result.errors.map((e: string) => (
                    <li key={e} className="text-[11px] text-alerte flex gap-1.5">
                      <XCircle className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                      {e}
                    </li>
                  ))}
                </ul>
              )}

              {result.warnings?.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {result.warnings.map((w: string) => (
                    <li key={w} className="text-[11px] text-ambre-deep flex gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}

              {result.stats && (
                <dl className="mt-4 pt-3 border-t border-pierre-line/60 grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    ['Mots', result.stats.words],
                    ['Sections H2', result.stats.h2],
                    ['FAQ', result.stats.faqs],
                    ['Lecture', `${result.stats.read_minutes} min`],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between text-[11px]">
                      <dt className="text-pierre-deep">{k}</dt>
                      <dd className="font-bold text-ink tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}

          {conflicts?.conflicts?.length > 0 && (
            <section className="bg-ambre-soft border border-ambre/40 rounded-2xl p-5">
              <p className="flex items-center gap-2 text-xs font-bold text-terracotta-deep">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                Mots clés déjà revendiqués
              </p>
              <p className="text-[11px] text-ink-soft mt-1.5">
                Une page possède un mot clé. Citez le et liez vers son propriétaire
                plutôt que de le cibler une seconde fois.
              </p>
              <ul className="mt-3 space-y-2">
                {conflicts.conflicts.map((c: any) => (
                  <li key={`${c.keyword}-${c.article_id}`} className="text-[11px] text-ink">
                    <span className="font-mono font-semibold">{c.keyword}</span>
                    <span className="text-pierre-deep"> — déjà ciblé par </span>
                    <a
                      href={`/guides/${c.article_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta-deep font-semibold hover:underline"
                    >
                      {c.article_title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* SERP preview */}
          <section className="bg-white border border-pierre-line rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold text-ink">
              <Eye className="w-3.5 h-3.5 text-terracotta" aria-hidden="true" />
              Aperçu Google
            </h2>
            <div className="mt-4">
              <p className="text-[11px] text-pierre-deep flex items-center gap-1.5">
                <Globe className="w-3 h-3" aria-hidden="true" />
                {serp.url}
              </p>
              <p className="mt-1 text-[15px] text-info leading-snug">{serp.title}</p>
              <p className="mt-1 text-[11px] text-pierre-deep leading-relaxed">{serp.desc}</p>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------- right: fields */}
        <div className="space-y-5">
          <section className="bg-white border border-pierre-line rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-serif font-bold text-ink">Contenu</h2>

            <Field label="Titre (H1 visible)" required>
              <input
                value={draft.title || ''}
                onChange={(e) => set({ title: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field
              label="Slug"
              required
              hint={
                <button onClick={slugify} type="button" className="text-terracotta-deep font-semibold">
                  générer depuis le titre
                </button>
              }
            >
              <input
                value={draft.slug || ''}
                onChange={(e) => set({ slug: e.target.value })}
                className="admin-input font-mono"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Collection (cluster)" required>
                <select
                  value={draft.cluster_id || ''}
                  onChange={(e) => set({ cluster_id: e.target.value })}
                  className="admin-input"
                >
                  {CLUSTERS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Catégorie affichée" required>
                <input
                  value={draft.category || ''}
                  onChange={(e) => set({ category: e.target.value })}
                  className="admin-input"
                />
              </Field>
            </div>

            <Field label="Extrait" required hint={<Counter value={draft.excerpt || ''} min={150} max={200} />}>
              <textarea
                rows={2}
                value={draft.excerpt || ''}
                onChange={(e) => set({ excerpt: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field label="Auteur">
              <input
                value={draft.author || ''}
                onChange={(e) => set({ author: e.target.value })}
                placeholder="Atelier LUCÉA"
                className="admin-input"
              />
            </Field>

            <Field
              label="Corps de l article (HTML, commence par un H2)"
              required
              hint={
                <span className="text-pierre-deep">
                  {(draft.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length} mots ·{' '}
                  {(draft.content || '').match(/<h2[\s>]/gi)?.length || 0} H2
                </span>
              }
            >
              <textarea
                rows={16}
                value={draft.content || ''}
                onChange={(e) => set({ content: e.target.value })}
                className="admin-input font-mono text-[11px]"
              />
            </Field>
          </section>

          {/* ---- SEO ---- */}
          <section className="bg-white border border-pierre-line rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-serif font-bold text-ink">Référencement</h2>
            <p className="text-[11px] text-pierre-deep">
              Le canonical, les balises Open Graph et tout le JSON-LD sont générés par le
              serveur à partir de ces champs. Rien de tout cela ne s écrit à la main.
            </p>

            <Field label="Mot clé principal" required>
              <input
                value={draft.target_keyword || ''}
                onChange={(e) => set({ target_keyword: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field label="Titre SEO" required hint={<Counter value={draft.seo_title || ''} max={60} />}>
              <input
                value={draft.seo_title || ''}
                onChange={(e) => set({ seo_title: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field
              label="Meta description"
              required
              hint={<Counter value={draft.seo_meta_description || ''} min={140} max={160} />}
            >
              <textarea
                rows={3}
                value={draft.seo_meta_description || ''}
                onChange={(e) => set({ seo_meta_description: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field label="Mots clés SEO (3 minimum)" required hint={`${listField('seo_keywords').length} entrée(s)`}>
              <input
                value={listField('seo_keywords').join(', ')}
                onChange={(e) =>
                  set({ seo_keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })
                }
                placeholder="mot clé 1, mot clé 2, mot clé 3"
                className="admin-input"
              />
            </Field>

            <Field label="Tags">
              <input
                value={listField('tags').join(', ')}
                onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                className="admin-input"
              />
            </Field>
          </section>

          {/* ---- images ---- */}
          <section className="bg-white border border-pierre-line rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-serif font-bold text-ink">Images</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Image de couverture (URL)" required>
                <input
                  value={draft.banner_url || ''}
                  onChange={(e) => set({ banner_url: e.target.value })}
                  className="admin-input font-mono text-[11px]"
                />
              </Field>
              <Field label="Texte alternatif de la couverture" required>
                <input
                  value={draft.banner_alt || ''}
                  onChange={(e) => set({ banner_alt: e.target.value })}
                  className="admin-input"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {draft.banner_url && (
                <img
                  src={draft.banner_url}
                  alt=""
                  className="w-full max-w-xs aspect-[16/9] object-cover rounded-xl border border-pierre-line"
                />
              )}
              {articleId && (
                <div>
                  <button
                    onClick={() => bannerRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 h-11 px-4 bg-ecru hover:bg-sable-soft text-ink text-xs font-semibold rounded-xl border border-pierre-line transition-colors disabled:opacity-50"
                  >
                    {uploading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      : <ImageUp className="w-3.5 h-3.5" aria-hidden="true" />}
                    Téléverser une couverture
                  </button>
                  <input
                    ref={bannerRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBanner(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-ink">
                Images du corps ({listField('content_images').length})
              </p>
              <p className="text-[10px] text-pierre-deep mt-0.5">
                Placez le jeton indiqué dans le corps de l article pour insérer l image.
              </p>

              <div className="mt-3 space-y-3">
                {listField('content_images').map((img: any, i: number) => (
                  <div key={i} className="bg-ecru border border-pierre-line rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[10px] font-bold text-terracotta-deep bg-white px-2 py-1 rounded">
                        {`{image:${i + 1}}`}
                      </code>
                      <button
                        onClick={() =>
                          set({ content_images: listField('content_images').filter((_, j) => j !== i) })
                        }
                        aria-label={`Supprimer l image ${i + 1}`}
                        className="w-8 h-8 grid place-items-center text-alerte hover:bg-alerte-soft rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {(['url', 'alt', 'title', 'caption'] as const).map((k) => (
                      <input
                        key={k}
                        value={img[k] || ''}
                        placeholder={k}
                        onChange={(e) => {
                          const next = [...listField('content_images')];
                          next[i] = { ...next[i], [k]: e.target.value };
                          set({ content_images: next });
                        }}
                        className="admin-input text-[11px]"
                        aria-label={`Image ${i + 1} ${k}`}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  set({ content_images: [...listField('content_images'), { url: '', alt: '', title: '', caption: '' }] })
                }
                className="mt-3 inline-flex items-center gap-1.5 h-11 px-4 bg-ecru hover:bg-sable-soft text-ink text-xs font-semibold rounded-xl border border-pierre-line transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Ajouter une image
              </button>
            </div>
          </section>

          {/* ---- FAQ ---- */}
          <section className="bg-white border border-pierre-line rounded-2xl p-5">
            <h2 className="text-sm font-serif font-bold text-ink">
              FAQ ({listField('faqs').length}) <span className="font-sans font-normal text-[11px] text-pierre-deep">— 4 minimum</span>
            </h2>
            <p className="text-[11px] text-pierre-deep mt-1">
              Ces textes alimentent l accordéon visible et le balisage FAQPage, mot pour mot.
            </p>

            <div className="mt-4 space-y-3">
              {listField('faqs').map((faq: any, i: number) => (
                <div key={i} className="bg-ecru border border-pierre-line rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pierre-deep">Question {i + 1}</span>
                    <button
                      onClick={() => set({ faqs: listField('faqs').filter((_, j) => j !== i) })}
                      aria-label={`Supprimer la question ${i + 1}`}
                      className="w-8 h-8 grid place-items-center text-alerte hover:bg-alerte-soft rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <input
                    value={faq.question || ''}
                    placeholder="Question"
                    onChange={(e) => {
                      const next = [...listField('faqs')];
                      next[i] = { ...next[i], question: e.target.value };
                      set({ faqs: next });
                    }}
                    className="admin-input text-[11px]"
                    aria-label={`Question ${i + 1}`}
                  />
                  <textarea
                    rows={2}
                    value={faq.answer || ''}
                    placeholder="Réponse"
                    onChange={(e) => {
                      const next = [...listField('faqs')];
                      next[i] = { ...next[i], answer: e.target.value };
                      set({ faqs: next });
                    }}
                    className="admin-input text-[11px]"
                    aria-label={`Réponse ${i + 1}`}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => set({ faqs: [...listField('faqs'), { question: '', answer: '' }] })}
              className="mt-3 inline-flex items-center gap-1.5 h-11 px-4 bg-ecru hover:bg-sable-soft text-ink text-xs font-semibold rounded-xl border border-pierre-line transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Ajouter une question
            </button>
          </section>

          {/* ---- CTA ---- */}
          <section className="bg-white border border-pierre-line rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-serif font-bold text-ink">Bloc de conversion</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {(['category', 'link', 'title', 'description'] as const).map((k) => (
                <Field key={k} label={k}>
                  <input
                    value={draft.cta?.[k] || ''}
                    onChange={(e) => set({ cta: { ...(draft.cta || {}), [k]: e.target.value } })}
                    className="admin-input"
                  />
                </Field>
              ))}
            </div>
          </section>

          {/* ---- actions ---- */}
          <div className="sticky bottom-0 bg-ecru/95 backdrop-blur border-t border-pierre-line py-4 flex flex-wrap gap-3">
            <button
              onClick={() => save(false)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-white hover:bg-sable-soft text-ink text-xs font-bold rounded-xl border border-pierre-line transition-colors disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              Enregistrer le brouillon
            </button>
            <button
              onClick={() => save(true)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-terracotta hover:bg-terracotta-deep text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Publier
            </button>
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center h-12 px-6 text-ink-soft text-xs font-semibold"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
