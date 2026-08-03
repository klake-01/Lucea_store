import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Pencil, X, Loader2, RefreshCw, Check, ChevronDown,
  ChevronRight, ArrowLeft, ArrowRight, Upload, Search as SearchIcon, Star
} from 'lucide-react';
import { fetchApi, getStoredToken } from '../../lib/api';
import { formatMad } from '../../lib/format';
import { auditProductSeo, buildProductSeo } from '../../lib/productSeo';

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const emptyProductForm = {
  name: '',
  slug: '',
  description: '',
  status: 'published',
  imageAlt: '',
  seoKeywords: '',
  sku: '',
  priceMad: '299',
  stock: '10',
  sizeAttribute: '',
};

export const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [seoFor, setSeoFor] = useState<any>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyProductForm);
  // Files chosen in the create form, uploaded once the product has an id
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<any>(null);
  // Untouched copy of the variants as they were when the modal opened. The
  // submit handler diffs against it so a save only writes the rows that moved.
  const [editingBase, setEditingBase] = useState<any[]>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Admin listing so drafts and archived products are visible too
      const data = await fetchApi('/catalog/admin/products?limit=60');
      setProducts(data?.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Chargement du catalogue impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // The pending dismissal is cancelled on each new message, otherwise a second
  // save within three seconds is cleared early by the first message's timer.
  const flashTimer = useRef<number | undefined>(undefined);
  const flash = (message: string) => {
    setNotice(message);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setNotice(''), 3000);
  };
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const created = await fetchApi('/catalog/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          slug: (form.slug.trim() || slugify(form.name)).toLowerCase(),
          description: form.description.trim() || null,
          brand: 'LUCEA',
          status: form.status,
          variants: [
            {
              sku: form.sku.trim().toUpperCase(),
              // Prices are entered in dirhams and stored in minor units
              price_cents: Math.round(Number(form.priceMad) * 100),
              stock: Number(form.stock),
              size_attribute: form.sizeAttribute.trim() || null,
            },
          ],
          seo_keywords: form.seoKeywords.trim() || null,
          // Images are uploaded straight after creation, never referenced by URL
          images: [],
        }),
      });

      if (newFiles.length > 0) {
        await uploadFiles(created.id, newFiles, form.imageAlt.trim() || form.name.trim());
      }

      setCreateOpen(false);
      setForm(emptyProductForm);
      setNewFiles([]);
      flash(
        newFiles.length
          ? `Produit ${created.name} cree avec ${newFiles.length} image${newFiles.length > 1 ? 's' : ''}.`
          : `Produit ${created.name} cree.`
      );
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Creation du produit impossible.');
    } finally {
      setSaving(false);
    }
  };

  /** Opens the edit modal with a deep enough copy that editing is local. */
  const openEditor = (product: any) => {
    const variants = (product.variants ?? []).map((v: any) => ({ ...v }));
    setEditing({ ...product, variants });
    setEditingBase(variants.map((v: any) => ({ ...v })));
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError('');
    try {
      await fetchApi(`/catalog/admin/products/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editing.name.trim(),
          slug: editing.slug.trim().toLowerCase(),
          description: editing.description || null,
          status: editing.status,
          seo_title: editing.seo_title ?? '',
          seo_description: editing.seo_description ?? '',
          seo_keywords: editing.seo_keywords ?? '',
        }),
      });

      // Inventory rides along with the product save. Only rows whose stock or
      // price actually changed are sent, so an untouched save is one request.
      const moved = (editing.variants ?? []).filter((v: any) => {
        const before = editingBase.find((b) => b.id === v.id);
        if (!before) return false;
        return (
          Number(v.stock) !== Number(before.stock) ||
          Number(v.price_cents) !== Number(before.price_cents)
        );
      });

      for (const v of moved) {
        await fetchApi(`/catalog/admin/variants/${v.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            stock: Number(v.stock),
            price_cents: Number(v.price_cents),
          }),
        });
      }

      setEditing(null);
      flash(
        moved.length
          ? `Produit mis a jour, ${moved.length} variante${moved.length > 1 ? 's' : ''} ajustee${moved.length > 1 ? 's' : ''}.`
          : 'Produit mis a jour.'
      );
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Mise a jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: any) => {
    if (!window.confirm(`Supprimer definitivement "${product.name}" ? Cette action est irreversible.`)) {
      return;
    }
    setError('');
    try {
      await fetchApi(`/catalog/admin/products/${product.id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      flash('Produit supprime.');
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    }
  };

  const handleVariantSave = async (variantId: string, patch: Record<string, unknown>) => {
    setError('');
    try {
      const updated = await fetchApi(`/catalog/admin/variants/${variantId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants?.map((v: any) => (v.id === variantId ? updated : v)),
        }))
      );
      flash('Variante mise a jour.');
    } catch (err: any) {
      setError(err?.message || 'Mise a jour de la variante impossible.');
      await loadProducts();
    }
  };

  const handleVariantDelete = async (variantId: string, sku: string) => {
    if (!window.confirm(`Supprimer la variante ${sku} ?`)) return;
    setError('');
    try {
      await fetchApi(`/catalog/admin/variants/${variantId}`, { method: 'DELETE' });
      flash('Variante supprimee.');
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Suppression de la variante impossible.');
    }
  };

  const handleVariantAdd = async (productId: string) => {
    const sku = window.prompt('Reference SKU de la nouvelle variante');
    if (!sku) return;
    const priceMad = window.prompt('Prix en dirhams', '299');
    if (!priceMad) return;
    const stock = window.prompt('Stock initial', '10');
    if (stock === null) return;
    const size = window.prompt('Taille, par exemple 30 cm', '') || null;

    setError('');
    try {
      await fetchApi(`/catalog/admin/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          price_cents: Math.round(Number(priceMad) * 100),
          stock: Number(stock),
          size_attribute: size,
        }),
      });
      flash('Variante ajoutee.');
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Ajout de la variante impossible.');
    }
  };

  /**
   * Posts files to the API as multipart.
   *
   * FormData sets its own boundary, so Content-Type must not be forced. fetchApi
   * always sends JSON, which is why this uses fetch directly.
   */
  const uploadFiles = async (productId: string, files: File[], alt?: string) => {
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    if (alt) body.append('alt', alt);

    const token = getStoredToken();
    const res = await fetch(`/api/v1/catalog/admin/products/${productId}/images/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body,
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.detail || `Televersement echoue (${res.status})`);
    }
    return res.json();
  };

  /** Gallery uploader on an existing product. */
  const handleImageUpload = async (productId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingFor(productId);
    setError('');
    try {
      const created = await uploadFiles(productId, Array.from(files));
      flash(`${created.length} image${created.length > 1 ? 's ajoutees' : ' ajoutee'}.`);
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Televersement impossible.');
    } finally {
      setUploadingFor(null);
    }
  };

  /** Moves an image one slot left or right. Position 0 is the main image. */
  const handleImageMove = async (product: any, index: number, direction: -1 | 1) => {
    const images = [...(product.images ?? [])].sort((a, b) => a.position - b.position);
    const target = index + direction;
    if (target < 0 || target >= images.length) return;

    [images[index], images[target]] = [images[target], images[index]];

    setError('');
    try {
      await fetchApi(`/catalog/admin/products/${product.id}/images/order`, {
        method: 'PUT',
        body: JSON.stringify({ image_ids: images.map((i) => i.id) }),
      });
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Reordonnancement impossible.');
    }
  };

  const handleImageDelete = async (imageId: string) => {
    if (!window.confirm('Supprimer cette image ?')) return;
    setError('');
    try {
      await fetchApi(`/catalog/admin/images/${imageId}`, { method: 'DELETE' });
      flash('Image supprimee.');
      await loadProducts();
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">Produits et stocks</h1>
          <p className="text-xs text-pierre-deep mt-1">
            Creez un produit, ajustez les prix et les stocks, gerez les images.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProducts}
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
            onClick={() => { setForm(emptyProductForm); setCreateOpen(true); }}
            className="bg-ambre hover:bg-ambre-deep hover:text-white text-ink font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nouveau produit
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
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-ecru text-pierre-deep">
              <tr>
                <th scope="col" className="p-3 font-semibold w-8" />
                <th scope="col" className="p-3 font-semibold">Produit</th>
                <th scope="col" className="p-3 font-semibold">Adresse</th>
                <th scope="col" className="p-3 font-semibold">Variantes</th>
                <th scope="col" className="p-3 font-semibold">Stock total</th>
                <th scope="col" className="p-3 font-semibold">Statut</th>
                <th scope="col" className="p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre-line text-ink-soft">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-pierre-deep">Chargement du catalogue</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-pierre-deep">Aucun produit pour le moment.</td></tr>
              ) : (
                products.map((p) => {
                  const totalStock = p.variants?.reduce((sum: number, v: any) => sum + v.stock, 0) ?? 0;
                  const isOpen = expanded === p.id;

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-ecru/60">
                        <td className="p-3">
                          <button
                            onClick={() => setExpanded(isOpen ? null : p.id)}
                            className="p-1 text-pierre-deep hover:text-ink"
                            aria-expanded={isOpen}
                            aria-label={isOpen ? `Replier ${p.name}` : `Deplier ${p.name}`}
                          >
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-ink block">{p.name}</span>
                          {p.images?.length > 0 && (
                            <span className="text-[10px] text-pierre-deep">
                              {p.images.length} image{p.images.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-pierre-deep">{p.slug}</td>
                        <td className="p-3 font-mono text-terracotta-deep">
                          {p.variants?.map((v: any) => v.sku).join(', ') || 'aucune'}
                        </td>
                        <td className={`p-3 font-bold tabular-nums ${totalStock <= 5 ? 'text-alerte' : 'text-ink'}`}>
                          {totalStock}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-[10px] uppercase font-semibold ${
                              p.status === 'published' ? 'bg-succes-soft text-succes' : 'bg-sable text-ink'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditor(p)}
                              className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                              aria-label={`Modifier ${p.name}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSeoFor(p)}
                              className="p-1.5 text-pierre-deep hover:text-terracotta-deep"
                              aria-label={`Voir le referencement de ${p.name}`}
                              title="Referencement"
                            >
                              <SearchIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1.5 text-pierre-deep hover:text-alerte"
                              aria-label={`Supprimer ${p.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-ecru/60">
                          <td colSpan={7} className="p-4 space-y-6">
                            {/* Variants */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-ink text-xs">Variantes et stocks</h3>
                                <button
                                  onClick={() => handleVariantAdd(p.id)}
                                  className="text-[11px] font-semibold text-terracotta-deep hover:text-terracotta flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" aria-hidden="true" />
                                  Ajouter une variante
                                </button>
                              </div>

                              {(p.variants ?? []).map((v: any) => (
                                <VariantRow
                                  key={v.id}
                                  variant={v}
                                  onSave={handleVariantSave}
                                  onDelete={handleVariantDelete}
                                />
                              ))}
                            </div>

                            {/* Gallery */}
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold text-ink text-xs">
                                    Galerie, {(p.images ?? []).length} sur 8
                                  </h3>
                                  <p className="text-[11px] text-pierre-deep mt-0.5">
                                    La premiere image est l image principale: fiche, carte, apercu social et donnees structurees.
                                  </p>
                                </div>

                                <label
                                  className={`shrink-0 inline-flex items-center gap-1.5 bg-ambre hover:bg-ambre-deep hover:text-white text-ink text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                    uploadingFor === p.id ? 'opacity-60 pointer-events-none' : ''
                                  }`}
                                >
                                  {uploadingFor === p.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                                  )}
                                  Televerser des images
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    multiple
                                    className="sr-only"
                                    onChange={(e) => {
                                      handleImageUpload(p.id, e.target.files);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>

                              {(p.images ?? []).length === 0 ? (
                                <p className="bg-white border border-dashed border-pierre-line rounded-xl p-6 text-center text-[11px] text-pierre-deep">
                                  Aucune image. Un produit sans photo ne se vend pas en paiement a la livraison.
                                </p>
                              ) : (
                                <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                  {[...(p.images ?? [])]
                                    .sort((a: any, b: any) => a.position - b.position)
                                    .map((img: any, index: number, all: any[]) => (
                                      <li
                                        key={img.id}
                                        className="bg-white border border-pierre-line rounded-xl overflow-hidden"
                                      >
                                        <div className="relative aspect-square bg-sable-soft">
                                          <img
                                            src={img.url}
                                            alt={img.alt}
                                            width={200}
                                            height={200}
                                            loading="lazy"
                                            className="w-full h-full object-cover"
                                          />
                                          {index === 0 && (
                                            <span className="absolute top-1.5 left-1.5 bg-ambre text-ink text-[9px] font-bold px-1.5 py-1 rounded inline-flex items-center gap-1 leading-none">
                                              <Star className="w-2.5 h-2.5 fill-ink" aria-hidden="true" />
                                              PRINCIPALE
                                            </span>
                                          )}
                                        </div>

                                        <div className="p-2 flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-0.5">
                                            <button
                                              onClick={() => handleImageMove(p, index, -1)}
                                              disabled={index === 0}
                                              className="p-1 text-pierre-deep hover:text-terracotta-deep disabled:opacity-30"
                                              aria-label={`Deplacer l image ${index + 1} vers la gauche`}
                                            >
                                              <ArrowLeft className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => handleImageMove(p, index, 1)}
                                              disabled={index === all.length - 1}
                                              className="p-1 text-pierre-deep hover:text-terracotta-deep disabled:opacity-30"
                                              aria-label={`Deplacer l image ${index + 1} vers la droite`}
                                            >
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                          </div>

                                          <button
                                            onClick={() => handleImageDelete(img.id)}
                                            className="p-1 text-pierre-deep hover:text-alerte"
                                            aria-label={`Supprimer l image ${index + 1}`}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create product */}
      {createOpen && (
        <Modal title="Ajouter un produit" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateProduct} className="space-y-3">
            <Field label="Nom du produit" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
                placeholder="NURA Veilleuse prenom"
                className="admin-input"
              />
            </Field>

            <Field label="Adresse de la page" hint="Generee automatiquement, modifiable">
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="nura-veilleuse-prenom"
                className="admin-input font-mono"
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ce que le client doit savoir avant d acheter"
                className="admin-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Reference SKU" required>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                  placeholder="NURA-20"
                  className="admin-input font-mono"
                />
              </Field>

              <Field label="Taille">
                <input
                  type="text"
                  value={form.sizeAttribute}
                  onChange={(e) => setForm({ ...form, sizeAttribute: e.target.value })}
                  placeholder="20 cm"
                  className="admin-input"
                />
              </Field>

              <Field label="Prix en dirhams" required>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.priceMad}
                  onChange={(e) => setForm({ ...form, priceMad: e.target.value })}
                  className="admin-input tabular-nums"
                />
              </Field>

              <Field label="Stock initial" required>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="admin-input tabular-nums"
                />
              </Field>
            </div>

            {/* Images are uploaded from the machine. There is no URL field on
                purpose: a hotlinked image breaks the day the other site
                reorganises, and it cannot be resized or served from our bucket. */}
            <FilePicker
              files={newFiles}
              onChange={setNewFiles}
              hint="Jusqu a 8 images. La premiere devient l image principale du produit."
            />

            {newFiles.length > 0 && (
              <Field
                label="Texte alternatif"
                hint="Decrit les images pour Google Images et les lecteurs d ecran"
              >
                <input
                  type="text"
                  value={form.imageAlt}
                  onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
                  placeholder="Veilleuse gravee posee sur une table de chevet"
                  className="admin-input"
                />
              </Field>
            )}

            <Field
              label="Mots cles"
              hint="Separes par des virgules. Laissez vide pour les deriver du nom et de la description."
            >
              <input
                type="text"
                value={form.seoKeywords}
                onChange={(e) => setForm({ ...form, seoKeywords: e.target.value })}
                placeholder="veilleuse prenom, lampe personnalisee maroc"
                className="admin-input"
              />
            </Field>

            <Field label="Statut">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="admin-input"
              >
                <option value="published">Publie</option>
                <option value="draft">Brouillon</option>
                <option value="archived">Archive</option>
              </select>
            </Field>

            <ModalActions
              saving={saving}
              onCancel={() => { setCreateOpen(false); setNewFiles([]); }}
              submitLabel="Creer le produit"
            />
          </form>
        </Modal>
      )}

      {/* SEO audit */}
      {seoFor && (
        <Modal title={`Referencement de ${seoFor.name}`} onClose={() => setSeoFor(null)}>
          <SeoPanel product={seoFor} />
        </Modal>
      )}

      {/* Edit product */}
      {editing && (
        <Modal title={`Modifier ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdateProduct} className="space-y-3">
            <Field label="Nom du produit" required>
              <input
                type="text"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field label="Adresse de la page" required>
              <input
                type="text"
                required
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                className="admin-input font-mono"
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={5}
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="admin-input"
              />
            </Field>

            <Field label="Statut">
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                className="admin-input"
              >
                <option value="published">Publie</option>
                <option value="draft">Brouillon</option>
                <option value="archived">Archive</option>
              </select>
            </Field>

            <fieldset className="pt-4 border-t border-pierre-line space-y-2">
              <legend className="text-xs font-semibold text-ink">Inventaire</legend>
              <p className="text-[11px] text-pierre-deep">
                Le stock est le nombre d unites physiques. Les unites reservees sont
                promises a des commandes en cours et sont retirees du stock a la
                livraison, pas a la saisie.
              </p>

              {(editing.variants ?? []).length === 0 ? (
                <p className="text-[11px] text-pierre-deep italic py-2">
                  Ce produit n a aucune variante. Ajoutez en une depuis la ligne du
                  tableau pour lui donner un prix et un stock.
                </p>
              ) : (
                <div className="space-y-2">
                  {(editing.variants ?? []).map((v: any, index: number) => {
                    const reserved = Number(v.reserved ?? 0);
                    const available = Math.max(0, Number(v.stock ?? 0) - reserved);
                    const patchVariant = (patch: Record<string, unknown>) =>
                      setEditing({
                        ...editing,
                        variants: editing.variants.map((row: any, i: number) =>
                          i === index ? { ...row, ...patch } : row
                        ),
                      });

                    return (
                      <div
                        key={v.id}
                        className="bg-ecru border border-pierre-line rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-ink text-[11px]">
                            {v.sku}
                            {v.size_attribute && (
                              <span className="ml-2 font-sans font-normal text-pierre-deep">
                                {v.size_attribute}
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg tabular-nums ${
                              available <= 0
                                ? 'bg-alerte-soft text-alerte'
                                : available <= 5
                                  ? 'bg-ambre-soft text-terracotta-deep'
                                  : 'bg-succes-soft text-succes'
                            }`}
                          >
                            {available} disponible{available > 1 ? 's' : ''}
                            {reserved > 0 && ` / ${reserved} reservee${reserved > 1 ? 's' : ''}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              className="text-[10px] text-pierre-deep block mb-0.5"
                              htmlFor={`edit-price-${v.id}`}
                            >
                              Prix en dirhams
                            </label>
                            <input
                              id={`edit-price-${v.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={Math.round(Number(v.price_cents ?? 0) / 100)}
                              onChange={(e) =>
                                patchVariant({
                                  price_cents: Math.max(0, Math.round(Number(e.target.value) * 100)) || 0,
                                })
                              }
                              className="admin-input tabular-nums"
                            />
                          </div>
                          <div>
                            <label
                              className="text-[10px] text-pierre-deep block mb-0.5"
                              htmlFor={`edit-stock-${v.id}`}
                            >
                              Stock physique
                            </label>
                            <input
                              id={`edit-stock-${v.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={String(v.stock ?? 0)}
                              onChange={(e) =>
                                patchVariant({ stock: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="admin-input tabular-nums"
                            />
                          </div>
                        </div>

                        {Number(v.stock ?? 0) < reserved && (
                          <p className="text-[10px] text-alerte font-semibold">
                            Stock inferieur aux unites deja promises. Certaines commandes
                            ne pourront pas etre honorees.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset className="pt-4 border-t border-pierre-line space-y-3">
              <legend className="text-xs font-semibold text-ink">
                Referencement, optionnel
              </legend>
              <p className="text-[11px] text-pierre-deep">
                Laissez vide pour que la fiche derive automatiquement son titre, sa description
                et ses mots cles du nom et de la description du produit.
              </p>

              <Field
                label="Titre de la page"
                hint={`${(editing.seo_title || buildProductSeo(editing).title).length} caracteres, viser 30 a 60`}
              >
                <input
                  type="text"
                  value={editing.seo_title || ''}
                  onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
                  placeholder={buildProductSeo(editing).title}
                  className="admin-input"
                />
              </Field>

              <Field
                label="Meta description"
                hint={`${(editing.seo_description || buildProductSeo(editing).description).length} caracteres, viser 120 a 158`}
              >
                <textarea
                  rows={3}
                  value={editing.seo_description || ''}
                  onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })}
                  placeholder={buildProductSeo(editing).description}
                  className="admin-input"
                />
              </Field>

              <Field label="Mots cles" hint="Separes par des virgules">
                <input
                  type="text"
                  value={editing.seo_keywords || ''}
                  onChange={(e) => setEditing({ ...editing, seo_keywords: e.target.value })}
                  placeholder={buildProductSeo(editing).keywords.join(', ')}
                  className="admin-input"
                />
              </Field>
            </fieldset>

            <ModalActions saving={saving} onCancel={() => setEditing(null)} submitLabel="Enregistrer" />
          </form>
        </Modal>
      )}
    </div>
  );
};


/**
 * Local file chooser with previews and ordering.
 *
 * Used before a product exists, so the files are held in memory and uploaded
 * once the record has an id. Object URLs are revoked on unmount, otherwise
 * every preview leaks a blob for the life of the tab.
 */
export const FilePicker: React.FC<{
  files: File[];
  onChange: (files: File[]) => void;
  hint?: string;
  max?: number;
}> = ({ files, onChange, hint, max = 8 }) => {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'));
    onChange([...files, ...incoming].slice(0, max));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <span className="text-xs font-semibold text-ink block mb-1.5">Images du produit</span>

      <label className="flex flex-col items-center justify-center gap-2 w-full py-6 px-4 border border-dashed border-pierre-line rounded-xl bg-ecru hover:border-ambre cursor-pointer transition-colors text-center">
        <Upload className="w-5 h-5 text-terracotta" aria-hidden="true" />
        <span className="text-xs font-semibold text-ink">
          Choisir des images depuis votre appareil
        </span>
        <span className="text-[11px] text-pierre-deep">
          PNG, JPG ou WebP, 5 Mo maximum par fichier
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
      </label>

      {hint && <span className="text-[11px] text-pierre-deep mt-1.5 block">{hint}</span>}

      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="bg-white border border-pierre-line rounded-xl overflow-hidden">
              <div className="relative aspect-square bg-sable-soft">
                {previews[index] && (
                  <img src={previews[index]} alt="" className="w-full h-full object-cover" />
                )}
                {index === 0 && (
                  <span className="absolute top-1 left-1 bg-ambre text-ink text-[9px] font-bold px-1.5 py-1 rounded leading-none">
                    PRINCIPALE
                  </span>
                )}
              </div>
              <div className="p-1.5 flex items-center justify-between gap-1">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1 text-pierre-deep hover:text-terracotta-deep disabled:opacity-30"
                    aria-label={`Deplacer l image ${index + 1} vers la gauche`}
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === files.length - 1}
                    className="p-1 text-pierre-deep hover:text-terracotta-deep disabled:opacity-30"
                    aria-label={`Deplacer l image ${index + 1} vers la droite`}
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                  className="p-1 text-pierre-deep hover:text-alerte"
                  aria-label={`Retirer l image ${index + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ---------------- helpers ---------------- */

/** Shows what the storefront will publish for this product, and what is missing. */
const SeoPanel: React.FC<{ product: any }> = ({ product }) => {
  const seo = buildProductSeo(product);
  const audit = auditProductSeo(product);
  const tone =
    audit.score >= 85 ? 'text-succes' : audit.score >= 60 ? 'text-terracotta-deep' : 'text-alerte';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className={`text-3xl font-serif font-bold tabular-nums ${tone}`}>
          {audit.score}
        </span>
        <p className="text-xs text-pierre-deep">
          sur 100. Chaque critere non rempli coute des positions sur Google
          et de la confiance a l achat.
        </p>
      </div>

      {/* Search result preview */}
      <div className="bg-ecru border border-pierre-line rounded-xl p-4">
        <p className="text-[10px] text-pierre-deep uppercase tracking-wide">
          Apercu dans les resultats de recherche
        </p>
        <p className="mt-2.5 text-[13px] text-info leading-snug">{seo.title}</p>
        <p className="text-[11px] text-succes mt-1">luceamaroc.com/products/{product.slug}</p>
        <p className="text-[11px] text-ink-soft mt-1.5 leading-relaxed">{seo.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-ink">
          Mots cles cibles
          <span className="font-normal text-pierre-deep ml-1.5">
            {seo.isOverridden.keywords ? 'definis manuellement' : 'derives automatiquement'}
          </span>
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {seo.keywords.map((k) => (
            <li key={k} className="bg-ambre-soft text-terracotta-deep text-[11px] px-2 py-1 rounded">
              {k}
            </li>
          ))}
        </ul>
      </div>

      <ul className="space-y-2">
        {audit.checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2.5 text-xs">
            {check.passed ? (
              <Check className="w-4 h-4 text-succes shrink-0 mt-px" aria-hidden="true" />
            ) : (
              <X className="w-4 h-4 text-alerte shrink-0 mt-px" aria-hidden="true" />
            )}
            <span>
              <span className={check.passed ? 'text-ink-soft' : 'text-ink font-medium'}>
                {check.label}
              </span>
              {!check.passed && (
                <span className="block text-[11px] text-pierre-deep mt-0.5">{check.hint}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const VariantRow: React.FC<{
  variant: any;
  onSave: (variantId: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (variantId: string, sku: string) => Promise<void>;
}> = ({ variant, onSave, onDelete }) => {
  const [priceMad, setPriceMad] = useState(String(variant.price_cents / 100));
  const [stock, setStock] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  const dirty =
    Math.round(Number(priceMad) * 100) !== variant.price_cents || Number(stock) !== variant.stock;

  const save = async () => {
    setSaving(true);
    await onSave(variant.id, {
      price_cents: Math.round(Number(priceMad) * 100),
      stock: Number(stock),
    });
    setSaving(false);
  };

  return (
    <div className="bg-white border border-pierre-line rounded-xl p-3 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-32">
        <span className="text-[10px] text-pierre-deep block">Reference</span>
        <span className="font-mono font-semibold text-ink text-xs">{variant.sku}</span>
        {variant.size_attribute && (
          <span className="text-[10px] text-pierre-deep block">{variant.size_attribute}</span>
        )}
      </div>

      <div>
        <label className="text-[10px] text-pierre-deep block mb-0.5" htmlFor={`price-${variant.id}`}>
          Prix en dirhams
        </label>
        <input
          id={`price-${variant.id}`}
          type="number"
          min="0"
          value={priceMad}
          onChange={(e) => setPriceMad(e.target.value)}
          className="w-24 bg-ecru border border-pierre-line rounded-lg p-1.5 text-xs text-ink tabular-nums focus:outline-none focus:border-terracotta"
        />
      </div>

      <div>
        <label className="text-[10px] text-pierre-deep block mb-0.5" htmlFor={`stock-${variant.id}`}>
          Stock
        </label>
        <input
          id={`stock-${variant.id}`}
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-20 bg-ecru border border-pierre-line rounded-lg p-1.5 text-xs text-ink tabular-nums focus:outline-none focus:border-terracotta"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="bg-ambre hover:bg-ambre-deep hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-ink text-[11px] font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={() => onDelete(variant.id, variant.sku)}
          className="p-2 text-pierre-deep hover:text-alerte"
          aria-label={`Supprimer la variante ${variant.sku}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <span className="text-[10px] text-pierre-deep w-full sm:w-auto">
        Prix actuel {formatMad(variant.price_cents)}
      </span>
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title, onClose, children,
}) => (
  <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="bg-white border border-pierre-line rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
    >
      <div className="p-5 border-b border-pierre-line flex items-center justify-between sticky top-0 bg-white">
        <h2 className="text-lg font-serif font-bold text-ink">{title}</h2>
        <button onClick={onClose} className="p-1.5 text-pierre-deep hover:text-ink" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-ink block mb-1.5">
      {label}
      {required && <span className="text-alerte"> *</span>}
    </span>
    {children}
    {hint && <span className="text-[11px] text-pierre-deep block mt-1">{hint}</span>}
  </label>
);

const ModalActions: React.FC<{
  saving: boolean;
  onCancel: () => void;
  submitLabel: string;
}> = ({ saving, onCancel, submitLabel }) => (
  <div className="flex justify-end gap-2 pt-4 border-t border-pierre-line">
    <button
      type="button"
      onClick={onCancel}
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
      {submitLabel}
    </button>
  </div>
);
