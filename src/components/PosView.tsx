import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Banknote,
  Check,
  CreditCard,
  Layers,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User,
} from 'lucide-react';
import {
  getProductsWithStock,
  registrarVentaLocal,
  subscribePosChanges,
} from '../services/localPosService';
import type {
  CartItem,
  MetodoPago,
  ProductWithStock,
  Profile,
  TicketData,
  Warehouse,
} from '../types/pos';
import { formatMoney } from '../lib/format';

interface PosViewProps {
  warehouse: Warehouse;
  profile: Profile;
  onSaleComplete: (ticket: TicketData) => void;
}

interface PosDraft {
  cart: CartItem[];
  clienteNombre: string;
  descuento: string;
  notas: string;
  metodoPago: MetodoPago;
  montoRecibido: string;
  mixEfectivo: string;
  mixTransferencia: string;
  mixTarjeta: string;
}

const DRAFT_PREFIX = 'pos-ventas-draft-';

function loadPosDraft(warehouseId: string): PosDraft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${warehouseId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PosDraft>;
    return {
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
      clienteNombre: typeof parsed.clienteNombre === 'string' ? parsed.clienteNombre : '',
      descuento: typeof parsed.descuento === 'string' ? parsed.descuento : '',
      notas: typeof parsed.notas === 'string' ? parsed.notas : '',
      metodoPago:
        parsed.metodoPago === 'efectivo' ||
        parsed.metodoPago === 'transferencia' ||
        parsed.metodoPago === 'tarjeta' ||
        parsed.metodoPago === 'mixto'
          ? parsed.metodoPago
          : 'efectivo',
      montoRecibido: typeof parsed.montoRecibido === 'string' ? parsed.montoRecibido : '',
      mixEfectivo: typeof parsed.mixEfectivo === 'string' ? parsed.mixEfectivo : '',
      mixTransferencia:
        typeof parsed.mixTransferencia === 'string' ? parsed.mixTransferencia : '',
      mixTarjeta: typeof parsed.mixTarjeta === 'string' ? parsed.mixTarjeta : '',
    };
  } catch {
    return null;
  }
}

function savePosDraft(warehouseId: string, draft: PosDraft) {
  try {
    const isEmpty =
      draft.cart.length === 0 &&
      !draft.clienteNombre &&
      !draft.descuento &&
      !draft.notas &&
      !draft.montoRecibido &&
      !draft.mixEfectivo &&
      !draft.mixTransferencia &&
      !draft.mixTarjeta &&
      draft.metodoPago === 'efectivo';
    if (isEmpty) {
      localStorage.removeItem(`${DRAFT_PREFIX}${warehouseId}`);
    } else {
      localStorage.setItem(`${DRAFT_PREFIX}${warehouseId}`, JSON.stringify(draft));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function clearPosDraft(warehouseId: string) {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${warehouseId}`);
  } catch {
    // Ignore
  }
}

export function PosView({ warehouse, profile, onSaleComplete }: PosViewProps) {
  const initialDraft = useMemo(() => loadPosDraft(warehouse.id), [warehouse.id]);
  const hydratedWarehouseRef = useRef<string>(warehouse.id);

  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => initialDraft?.cart ?? []);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [clienteNombre, setClienteNombre] = useState(() => initialDraft?.clienteNombre ?? '');
  const [descuento, setDescuento] = useState(() => initialDraft?.descuento ?? '');
  const [notas, setNotas] = useState(() => initialDraft?.notas ?? '');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(
    () => initialDraft?.metodoPago ?? 'efectivo'
  );
  const [montoRecibido, setMontoRecibido] = useState(() => initialDraft?.montoRecibido ?? '');

  // Pagos mixtos
  const [mixEfectivo, setMixEfectivo] = useState(() => initialDraft?.mixEfectivo ?? '');
  const [mixTransferencia, setMixTransferencia] = useState(
    () => initialDraft?.mixTransferencia ?? ''
  );
  const [mixTarjeta, setMixTarjeta] = useState(() => initialDraft?.mixTarjeta ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchInventory = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const merged = getProductsWithStock(warehouse.id);
      setProducts(merged);
      setCart((prev) =>
        prev
          .map((item) => {
            const fresh = merged.find((p) => p.id === item.product.id);
            if (!fresh || fresh.stock <= 0) return null;
            return {
              ...item,
              product: fresh,
              cantidad: Math.min(item.cantidad, fresh.stock),
            };
          })
          .filter((x): x is CartItem => x !== null)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando catálogo');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [warehouse.id]);

  // Al cambiar de sucursal, cargar el borrador propio de esa sucursal (sin borrarlo)
  useEffect(() => {
    if (hydratedWarehouseRef.current !== warehouse.id) {
      const saved = loadPosDraft(warehouse.id);
      hydratedWarehouseRef.current = warehouse.id;
      setCart(saved?.cart ?? []);
      setQtyInputs({});
      setPriceInputs({});
      setClienteNombre(saved?.clienteNombre ?? '');
      setDescuento(saved?.descuento ?? '');
      setNotas(saved?.notas ?? '');
      setMetodoPago(saved?.metodoPago ?? 'efectivo');
      setMontoRecibido(saved?.montoRecibido ?? '');
      setMixEfectivo(saved?.mixEfectivo ?? '');
      setMixTransferencia(saved?.mixTransferencia ?? '');
      setMixTarjeta(saved?.mixTarjeta ?? '');
      setSubmitError(null);
    }
    fetchInventory();
  }, [warehouse.id, fetchInventory]);

  // Persistir borrador de venta en curso en localStorage por sucursal
  useEffect(() => {
    if (hydratedWarehouseRef.current !== warehouse.id) return;
    savePosDraft(warehouse.id, {
      cart,
      clienteNombre,
      descuento,
      notas,
      metodoPago,
      montoRecibido,
      mixEfectivo,
      mixTransferencia,
      mixTarjeta,
    });
  }, [
    warehouse.id,
    cart,
    clienteNombre,
    descuento,
    notas,
    metodoPago,
    montoRecibido,
    mixEfectivo,
    mixTransferencia,
    mixTarjeta,
  ]);

  // Sincronización reactiva local (cambios de precios, cancelaciones o restaurar demo)
  useEffect(() => {
    return subscribePosChanges(() => {
      fetchInventory(true);
    });
  }, [fetchInventory]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyInStock && p.stock <= 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q) ?? false) ||
        (p.dimensions?.toLowerCase().includes(q) ?? false) ||
        (p.thickness_mm != null && String(p.thickness_mm).includes(q))
      );
    });
  }, [products, search, onlyInStock]);

  const cartQtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of cart) m.set(item.product.id, item.cantidad);
    return m;
  }, [cart]);

  const addToCart = (product: ProductWithStock) => {
    setSubmitError(null);
    if (product.stock <= 0) return;

    const existing = cart.find((i) => i.product.id === product.id);
    if (existing && existing.cantidad >= product.stock) {
      setSubmitError(`No hay más existencias disponibles en ${warehouse.name} para "${product.name}".`);
      return;
    }

    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { product, cantidad: 1, precio_unitario: product.precio_venta }];
    });
  };

  const updateQty = (productId: string, nextQty: number) => {
    setSubmitError(null);
    const target = cart.find((i) => i.product.id === productId);
    if (target && nextQty > target.product.stock) {
      setSubmitError(`No hay suficientes existencias disponibles en ${warehouse.name} para "${target.product.name}".`);
    }
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          const clamped = Math.max(0, Math.min(nextQty, i.product.stock));
          return { ...i, cantidad: clamped };
        })
        .filter((i) => i.cantidad > 0)
    );
  };

  const updatePrice = (productId: string, nextPrice: number) => {
    setSubmitError(null);
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, precio_unitario: Math.max(0, Number.isFinite(nextPrice) ? nextPrice : 0) }
          : i
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setPriceInputs((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const clearCart = () => {
    clearPosDraft(warehouse.id);
    setCart([]);
    setQtyInputs({});
    setPriceInputs({});
    setClienteNombre('');
    setDescuento('');
    setNotas('');
    setMetodoPago('efectivo');
    setMontoRecibido('');
    setMixEfectivo('');
    setMixTransferencia('');
    setMixTarjeta('');
    setSubmitError(null);
  };

  const subtotal = useMemo(
    () => cart.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0),
    [cart]
  );

  const descuentoNum = Math.max(0, Math.min(Number(descuento) || 0, subtotal));
  const total = Math.max(0, Number((subtotal - descuentoNum).toFixed(2)));

  // Cálculo de pagos y cambio
  const paymentSummary = useMemo(() => {
    if (metodoPago === 'efectivo') {
      const hasInput = montoRecibido.trim() !== '';
      const recibido = hasInput ? Number(montoRecibido) || 0 : total;
      const valid = total >= 0 && recibido >= total;
      return {
        monto_efectivo: total,
        monto_transferencia: 0,
        monto_tarjeta: 0,
        monto_recibido: recibido,
        cambio: valid ? Number((recibido - total).toFixed(2)) : 0,
        faltante: valid ? 0 : Number((total - recibido).toFixed(2)),
        valid,
      };
    }

    if (metodoPago === 'transferencia') {
      return {
        monto_efectivo: 0,
        monto_transferencia: total,
        monto_tarjeta: 0,
        monto_recibido: total,
        cambio: 0,
        faltante: 0,
        valid: true,
      };
    }

    if (metodoPago === 'tarjeta') {
      return {
        monto_efectivo: 0,
        monto_transferencia: 0,
        monto_tarjeta: total,
        monto_recibido: total,
        cambio: 0,
        faltante: 0,
        valid: true,
      };
    }

    // Mixto
    const ef = Math.max(0, Number(mixEfectivo) || 0);
    const tr = Math.max(0, Number(mixTransferencia) || 0);
    const ta = Math.max(0, Number(mixTarjeta) || 0);
    const pagado = Number((ef + tr + ta).toFixed(2));
    const valid = pagado >= total && tr + ta <= total + 0.001;
    const efectivoAplicado = Math.max(0, Number((total - tr - ta).toFixed(2)));
    const cambio = valid ? Math.max(0, Number((ef - efectivoAplicado).toFixed(2))) : 0;
    const faltante = pagado < total ? Number((total - pagado).toFixed(2)) : 0;

    return {
      monto_efectivo: Math.min(ef, efectivoAplicado),
      monto_transferencia: tr,
      monto_tarjeta: ta,
      monto_recibido: ef,
      cambio,
      faltante,
      valid: pagado >= total && tr + ta <= total + 0.001,
    };
  }, [metodoPago, montoRecibido, mixEfectivo, mixTransferencia, mixTarjeta, total]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!paymentSummary.valid) {
      setSubmitError(
        metodoPago === 'mixto' &&
          (Number(mixTransferencia) || 0) + (Number(mixTarjeta) || 0) > total
          ? 'La suma de transferencia + tarjeta no puede superar el total.'
          : 'El monto recibido es menor al total a cobrar.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const itemsPayload = cart.map((i) => ({
        product_id: i.product.id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }));

      const data = registrarVentaLocal({
        warehouse_id: warehouse.id,
        profile,
        metodo_pago: metodoPago,
        items: itemsPayload,
        monto_efectivo: paymentSummary.monto_efectivo,
        monto_transferencia: paymentSummary.monto_transferencia,
        monto_tarjeta: paymentSummary.monto_tarjeta,
        monto_recibido: paymentSummary.monto_recibido,
        descuento: descuentoNum,
        cliente_nombre: clienteNombre.trim() || 'Público General',
        notas: notas.trim() || null,
      });

      const ticket: TicketData = {
        folio: Number(data.folio),
        created_at: data.created_at,
        warehouse,
        cajero_nombre: profile.full_name || profile.email,
        cliente_nombre: clienteNombre.trim() || 'Público General',
        metodo_pago: metodoPago,
        monto_efectivo: paymentSummary.monto_efectivo,
        monto_transferencia: paymentSummary.monto_transferencia,
        monto_tarjeta: paymentSummary.monto_tarjeta,
        monto_recibido: paymentSummary.monto_recibido,
        cambio: Number(data.cambio ?? paymentSummary.cambio),
        subtotal: Number(data.subtotal ?? subtotal),
        descuento: Number(data.descuento ?? descuentoNum),
        total: Number(data.total ?? total),
        status: 'completada',
        notas: notas.trim() || null,
        items: cart.map((i) => ({
          sku: i.product.sku,
          product_name: i.product.name,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal: i.cantidad * i.precio_unitario,
        })),
      };

      clearCart();
      await fetchInventory();
      onSaleComplete(ticket);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al registrar la venta');
    } finally {
      setSubmitting(false);
    }
  };

  const quickCashValues = useMemo(() => {
    const bills = [100, 200, 500, 1000, 2000];
    const nextBills = bills.filter((b) => b > total);
    return nextBills.slice(0, 3);
  }, [total]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* COLUMNA IZQUIERDA: Catálogo y buscador */}
      <section className="lg:col-span-7 xl:col-span-8 space-y-3">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU, medida o espesor..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyInStock((v) => !v)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  onlyInStock
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Solo disponibles
              </button>

              <button
                type="button"
                onClick={() => fetchInventory()}
                disabled={loading}
                className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 transition-colors cursor-pointer"
                title="Actualizar catálogo"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearch('')}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white cursor-pointer"
            >
              Todos ({products.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2.5 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Grid de productos */}
        {loading ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center text-zinc-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="text-sm">Cargando catálogo de {warehouse.name}...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500 dark:text-zinc-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No se encontraron productos</p>
            <p className="text-xs mt-1">
              Ajusta tu búsqueda o desactiva &ldquo;Solo disponibles&rdquo;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredProducts.map((product) => {
              const inCart = cartQtyMap.get(product.id) ?? 0;
              const isOut = product.stock <= 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOut}
                  onClick={() => addToCart(product)}
                  className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                    isOut
                      ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/70 opacity-55 cursor-not-allowed'
                      : inCart > 0
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-500 ring-1 ring-emerald-500/30 cursor-pointer'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                        {product.sku}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isOut
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {isOut ? 'Sin existencias' : 'Disponible'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-1 line-clamp-2 leading-snug">
                      {product.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {product.category && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                          {product.category}
                        </span>
                      )}
                      {product.dimensions && <span>{product.dimensions}</span>}
                      {product.thickness_mm != null && <span>{product.thickness_mm}mm</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span
                      className={`text-base font-bold tabular-nums ${
                        product.precio_venta > 0
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatMoney(product.precio_venta)}
                    </span>

                    {inCart > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold tabular-nums">
                        <Check className="w-3 h-3" />
                        {inCart} en caja
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Plus className="w-3.5 h-3.5" />
                        Agregar
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* COLUMNA DERECHA: Carrito + Cobro */}
      <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]">
        {/* Cabecera del carrito */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Carrito de Venta
            </h2>
            {cart.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold tabular-nums">
                {cart.reduce((s, i) => s + i.cantidad, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-zinc-500 hover:text-red-500 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]">
          {cart.length === 0 ? (
            <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-center p-4">
              <ShoppingCart className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="text-xs mt-0.5">Selecciona productos de la izquierda</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {item.product.sku}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-zinc-400 hover:text-red-500 p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Cantidad */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setQtyInputs((prev) => {
                          const next = { ...prev };
                          delete next[item.product.id];
                          return next;
                        });
                        updateQty(item.product.id, item.cantidad - 1);
                      }}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:border-emerald-500 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={qtyInputs[item.product.id] ?? String(item.cantidad)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setQtyInputs((prev) => ({ ...prev, [item.product.id]: raw }));
                        if (raw !== '') {
                          const parsed = parseInt(raw, 10);
                          if (parsed > 0) updateQty(item.product.id, parsed);
                        }
                      }}
                      onBlur={() => {
                        setQtyInputs((prev) => {
                          const next = { ...prev };
                          delete next[item.product.id];
                          return next;
                        });
                      }}
                      className="w-12 h-7 text-center text-xs font-semibold tabular-nums rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={item.cantidad >= item.product.stock}
                      onClick={() => {
                        setQtyInputs((prev) => {
                          const next = { ...prev };
                          delete next[item.product.id];
                          return next;
                        });
                        updateQty(item.product.id, item.cantidad + 1);
                      }}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:border-emerald-500 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Precio unitario editable */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-400">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={
                        priceInputs[item.product.id] !== undefined
                          ? priceInputs[item.product.id]
                          : item.precio_unitario === 0
                            ? ''
                            : String(item.precio_unitario)
                      }
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        if ((raw.match(/\./g) ?? []).length > 1) return;
                        setPriceInputs((prev) => ({ ...prev, [item.product.id]: raw }));
                        updatePrice(item.product.id, raw === '' ? 0 : parseFloat(raw));
                      }}
                      onBlur={() => {
                        setPriceInputs((prev) => {
                          const next = { ...prev };
                          delete next[item.product.id];
                          return next;
                        });
                      }}
                      className="w-20 h-7 px-1.5 text-right text-xs font-medium tabular-nums rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-emerald-500"
                      title="Precio unitario"
                    />
                  </div>

                  {/* Subtotal línea */}
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums min-w-[70px] text-right">
                    {formatMoney(item.cantidad * item.precio_unitario)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sección de pago */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 space-y-3">
          {/* Cliente + Descuento */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Público General"
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="relative">
              <span className="text-[11px] text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                Desc $
              </span>
              <input
                type="number"
                min={0}
                step="1"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                placeholder="0.00"
                className="w-full pl-14 pr-2.5 py-1.5 text-right rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs tabular-nums focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Método de pago */}
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                { id: 'transferencia', label: 'Transf.', icon: ArrowLeftRight },
                { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                { id: 'mixto', label: 'Mixto', icon: Layers },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMetodoPago(id);
                  setSubmitError(null);
                }}
                className={`py-2 px-1 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                  metodoPago === id
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Inputs de Efectivo */}
          {metodoPago === 'efectivo' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  Recibido:
                </span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="flex-1 px-3 py-1.5 text-right font-semibold text-sm tabular-nums rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {total > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMontoRecibido(total.toFixed(2));
                      setSubmitError(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                      montoRecibido.trim() === '' || Number(montoRecibido) === total
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                    }`}
                  >
                    Exacto
                  </button>
                  {quickCashValues.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setMontoRecibido(String(val));
                        setSubmitError(null);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer tabular-nums"
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inputs de Mixto */}
          {metodoPago === 'mixto' && (
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Efectivo</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={mixEfectivo}
                  onChange={(e) => setMixEfectivo(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-right text-xs tabular-nums rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Transf.</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={mixTransferencia}
                  onChange={(e) => setMixTransferencia(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-right text-xs tabular-nums rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Tarjeta</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={mixTarjeta}
                  onChange={(e) => setMixTarjeta(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-right text-xs tabular-nums rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Notas opcionales */}
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Nota opcional (ej. referencia de transferencia)"
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-emerald-500"
          />

          {/* Resumen de totales */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1 text-xs tabular-nums">
            {descuentoNum > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
                TOTAL
              </span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoney(total)}
              </span>
            </div>

            {(metodoPago === 'efectivo' || metodoPago === 'mixto') && cart.length > 0 && (
              <div className="flex justify-between text-xs pt-0.5">
                {paymentSummary.faltante > 0 ? (
                  <>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Falta por cubrir
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {formatMoney(paymentSummary.faltante)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-500 font-medium">Cambio</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">
                      {formatMoney(paymentSummary.cambio)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckout}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando cobro...
              </>
            ) : (
              <>Cobrar {formatMoney(total)}</>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}
