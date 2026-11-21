import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Tag,
  Wrench,
  Layers,
} from 'lucide-react';
import {
  getAllProducts,
  subscribePosChanges,
  updateProductPrice,
} from '../services/localPosService';
import { formatMoney } from '../lib/format';

interface ProductPriceRow {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  dimensions: string | null;
  thickness_mm: number | null;
  precio_venta: number;
}

const HARDWARE_CATEGORIES = new Set([
  'barras',
  'jaladeras',
  'tornillos',
  'bisagras',
  'lijas orbitales',
  'lijas de agua',
  'lijas de lona',
  'ferretería',
  'ferreteria',
  'tinta sayer',
]);

function isHardwareProduct(p: ProductPriceRow): boolean {
  const cat = (p.category ?? '').trim().toLowerCase();
  if (HARDWARE_CATEGORIES.has(cat)) return true;
  if (p.sku.toUpperCase().startsWith('FER-')) return true;
  return Number(p.thickness_mm ?? 0) === 0;
}

export function PricesView() {
  const [products, setProducts] = useState<ProductPriceRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const rows: ProductPriceRow[] = getAllProducts().map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        dimensions: p.dimensions,
        thickness_mm: p.thickness_mm,
        precio_venta: Number(p.precio_venta ?? 0),
      }));
      setProducts(rows);

      const validIds = new Set(rows.map((r) => r.id));
      setDrafts((prev) => {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (validIds.has(k)) next[k] = v;
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando catálogo');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Sincronización reactiva local (cambios o restaurar demo)
  useEffect(() => {
    return subscribePosChanges(() => {
      loadProducts(true);
    });
  }, [loadProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q) ?? false) ||
        (p.dimensions?.toLowerCase().includes(q) ?? false)
    );
  }, [products, search]);

  const woodProducts = useMemo(
    () => filtered.filter((p) => !isHardwareProduct(p)),
    [filtered]
  );

  const hardwareProducts = useMemo(
    () => filtered.filter((p) => isHardwareProduct(p)),
    [filtered]
  );

  const pendingDraftIds = useMemo(
    () =>
      Object.keys(drafts).filter((id) => {
        const prod = products.find((p) => p.id === id);
        if (!prod) return false;
        const parsed = Math.max(0, parseFloat(drafts[id]) || 0);
        return parsed !== prod.precio_venta;
      }),
    [drafts, products]
  );

  const markSaved = (id: string) => {
    setSavedIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSavedIds((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 1500);
  };

  const handleSaveOne = async (row: ProductPriceRow) => {
    const raw = drafts[row.id];
    if (raw === undefined) return;
    const nextPrice = Math.max(0, Number((parseFloat(raw) || 0).toFixed(2)));
    setSavingId(row.id);
    setError(null);

    try {
      updateProductPrice(row.id, nextPrice);
      setProducts((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, precio_venta: nextPrice } : p))
      );
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      markSaved(row.id);
    } catch (err) {
      setError(
        `No se pudo actualizar "${row.name}": ${err instanceof Error ? err.message : 'Error'}`
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    if (pendingDraftIds.length === 0) return;
    setSavingAll(true);
    setError(null);
    try {
      for (const id of pendingDraftIds) {
        const nextPrice = Math.max(0, Number((parseFloat(drafts[id]) || 0).toFixed(2)));
        updateProductPrice(id, nextPrice);
        markSaved(id);
      }
      loadProducts(true);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando precios');
    } finally {
      setSavingAll(false);
    }
  };

  const renderTable = (
    title: string,
    icon: React.ReactNode,
    rows: ProductPriceRow[],
    isHardware: boolean
  ) => (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{title}</h3>
          <span className="px-2 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums">
            {rows.length}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-zinc-500">
          Sin productos en esta sección.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">{isHardware ? 'Tipo / Familia' : 'Categoría'}</th>
                <th className="px-4 py-2.5">{isHardware ? 'Presentación' : 'Espesor / Medida'}</th>
                <th className="px-4 py-2.5 text-right">Precio Actual</th>
                <th className="px-4 py-2.5 text-right">Precio Venta ($)</th>
                <th className="px-4 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((p) => {
                const hasDraft = drafts[p.id] !== undefined;
                const isModified =
                  hasDraft &&
                  Math.max(0, Number((parseFloat(drafts[p.id]) || 0).toFixed(2))) !==
                    p.precio_venta;
                const isSaved = Boolean(savedIds[p.id]);

                return (
                  <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{p.sku}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{p.category ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {isHardware
                        ? p.dimensions || '—'
                        : [
                            p.thickness_mm ? `${p.thickness_mm} mm` : null,
                            p.dimensions || null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.precio_venta > 0 ? (
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatMoney(p.precio_venta)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                          Sin precio
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={
                          hasDraft
                            ? drafts[p.id]
                            : p.precio_venta === 0
                              ? ''
                              : String(p.precio_venta)
                        }
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          if ((raw.match(/\./g) ?? []).length > 1) return;
                          setDrafts((prev) => ({ ...prev, [p.id]: raw }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && isModified) handleSaveOne(p);
                        }}
                        className="w-28 px-2.5 py-1 text-right text-sm tabular-nums rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!isModified || savingId === p.id || savingAll}
                        onClick={() => handleSaveOne(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white cursor-pointer transition-colors"
                      >
                        {savingId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isSaved ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {isSaved ? 'Guardado' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="max-w-[1300px] mx-auto px-4 py-5 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Catálogo de Precios ({products.length})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Modo Demo Local · Los cambios de precio se guardan al instante en este navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o SKU..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {pendingDraftIds.length > 0 && (
            <button
              type="button"
              disabled={savingAll}
              onClick={handleSaveAll}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {savingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Guardar todos ({pendingDraftIds.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => loadProducts()}
            disabled={loading}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 cursor-pointer"
            title="Recargar catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="space-y-5">
          {renderTable(
            'Catálogo (Maderas y Tableros)',
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            woodProducts,
            false
          )}
          {renderTable(
            'Catálogo de Ferretería',
            <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            hardwareProducts,
            true
          )}
        </div>
      )}
    </div>
  );
}
