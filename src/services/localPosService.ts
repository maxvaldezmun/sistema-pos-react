import {
  DEMO_ACCOUNTS,
  DEMO_WAREHOUSES,
  MOCK_PRODUCTS,
  type MockProduct,
} from '../data/mockProducts';
import type {
  CorteCaja,
  DetalleVenta,
  MetodoPago,
  ProductWithStock,
  Profile,
  Venta,
  Warehouse,
} from '../types/pos';

const STATE_KEY = 'pos_ventas_local_db_v2';
const SESSION_KEY = 'pos_ventas_local_session_v2';
const ACTIVE_WAREHOUSE_KEY = 'pos-ventas-active-warehouse-v2';
const DRAFT_PREFIX = 'pos-ventas-draft-';

interface LocalPosDb {
  products: MockProduct[];
  ventas: Venta[];
  cortes: CorteCaja[];
  nextFolio: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribePosChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

function createInitialDb(): LocalPosDb {
  return {
    products: MOCK_PRODUCTS.map((p) => ({
      ...p,
      stockByWarehouse: { ...p.stockByWarehouse },
    })),
    ventas: [],
    cortes: [],
    nextFolio: 1,
  };
}

function readDb(): LocalPosDb {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      const fresh = createInitialDb();
      localStorage.setItem(STATE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<LocalPosDb>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : createInitialDb().products,
      ventas: Array.isArray(parsed.ventas) ? parsed.ventas : [],
      cortes: Array.isArray(parsed.cortes) ? parsed.cortes : [],
      nextFolio: typeof parsed.nextFolio === 'number' && parsed.nextFolio >= 1 ? parsed.nextFolio : 1,
    };
  } catch {
    return createInitialDb();
  }
}

function writeDb(db: LocalPosDb) {
  localStorage.setItem(STATE_KEY, JSON.stringify(db));
  emitChange();
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- AUTENTICACIÓN DEMO LOCAL ---

export function getDemoWarehouses(): Warehouse[] {
  return DEMO_WAREHOUSES;
}

export function getStoredProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function signInLocal(email: string, password: string): Profile {
  const normalized = email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find(
    (a) => a.profile.email.toLowerCase() === normalized && a.password === password
  );
  if (!account) {
    throw new Error('Correo o contraseña incorrectos. Usa una cuenta demo (ej. admin@demo.pos / demo123).');
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(account.profile));
  return account.profile;
}

export function signInAsDemoProfile(profileId: string): Profile {
  const account = DEMO_ACCOUNTS.find((a) => a.profile.id === profileId);
  if (!account) throw new Error('Cuenta demo no encontrada.');
  localStorage.setItem(SESSION_KEY, JSON.stringify(account.profile));
  return account.profile;
}

export function signOutLocal() {
  localStorage.removeItem(SESSION_KEY);
}

// --- PRODUCTOS Y PRECIOS ---

export function getProductsWithStock(warehouseId: string): ProductWithStock[] {
  const db = readDb();
  return db.products
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      dimensions: p.dimensions,
      thickness_mm: p.thickness_mm,
      sheets_per_bundle: p.sheets_per_bundle,
      min_stock_sheets: p.min_stock_sheets,
      precio_venta: Number(p.precio_venta ?? 0),
      stock: Number(p.stockByWarehouse[warehouseId] ?? 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function getAllProducts(): MockProduct[] {
  const db = readDb();
  return [...db.products].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function updateProductPrice(productId: string, nextPrice: number): void {
  const db = readDb();
  const cleanPrice = Math.max(0, Number((Number(nextPrice) || 0).toFixed(2)));
  const idx = db.products.findIndex((p) => p.id === productId);
  if (idx === -1) throw new Error('Producto no encontrado');
  db.products[idx] = { ...db.products[idx], precio_venta: cleanPrice };
  writeDb(db);
}

// --- VENTAS ---

export interface RegistrarVentaLocalParams {
  warehouse_id: string;
  profile: Profile;
  metodo_pago: MetodoPago;
  items: { product_id: string; cantidad: number; precio_unitario: number }[];
  monto_efectivo: number;
  monto_transferencia: number;
  monto_tarjeta: number;
  monto_recibido: number;
  descuento: number;
  cliente_nombre: string;
  notas: string | null;
}

export function registrarVentaLocal(params: RegistrarVentaLocalParams): {
  venta_id: string;
  folio: number;
  subtotal: number;
  descuento: number;
  total: number;
  cambio: number;
  created_at: string;
} {
  const db = readDb();
  const wh = DEMO_WAREHOUSES.find((w) => w.id === params.warehouse_id);
  if (!wh || !wh.is_active || !wh.is_pos_enabled) {
    throw new Error('La ubicación seleccionada no está habilitada para ventas.');
  }

  if (!params.items || params.items.length === 0) {
    throw new Error('El carrito de venta no puede estar vacío.');
  }

  // 1. Validar stock disponible en la sucursal
  let subtotal = 0;
  const resolvedItems: { prod: MockProduct; cantidad: number; precio_unitario: number }[] = [];

  for (const item of params.items) {
    const prod = db.products.find((p) => p.id === item.product_id);
    if (!prod) throw new Error(`Producto no encontrado: ${item.product_id}`);
    const available = Number(prod.stockByWarehouse[params.warehouse_id] ?? 0);
    if (item.cantidad <= 0 || available < item.cantidad) {
      throw new Error(
        `Stock insuficiente en ${wh.name} para "${prod.name}" (no hay existencias suficientes).`
      );
    }
    const unitPrice = Math.max(0, Number(item.precio_unitario ?? prod.precio_venta));
    subtotal += unitPrice * item.cantidad;
    resolvedItems.push({ prod, cantidad: item.cantidad, precio_unitario: unitPrice });
  }

  const descuento = Math.max(0, Math.min(Number(params.descuento) || 0, subtotal));
  const total = Math.max(0, Number((subtotal - descuento).toFixed(2)));
  const pagado = Number(
    (
      (Number(params.monto_efectivo) || 0) +
      (Number(params.monto_transferencia) || 0) +
      (Number(params.monto_tarjeta) || 0)
    ).toFixed(2)
  );

  if (pagado + 0.001 < total) {
    throw new Error('El monto pagado es menor al total.');
  }

  const cambio =
    (params.metodo_pago === 'efectivo' || params.metodo_pago === 'mixto') &&
    params.monto_recibido > params.monto_efectivo
      ? Number((params.monto_recibido - params.monto_efectivo).toFixed(2))
      : Math.max(0, Number((pagado - total).toFixed(2)));

  // 2. Descontar existencias de la sucursal activa
  for (const { prod, cantidad } of resolvedItems) {
    prod.stockByWarehouse[params.warehouse_id] = Math.max(
      0,
      Number(prod.stockByWarehouse[params.warehouse_id] ?? 0) - cantidad
    );
  }

  // 3. Vincular al corte abierto si existe
  const openCorte = db.cortes.find(
    (c) => c.warehouse_id === params.warehouse_id && c.status === 'abierto'
  );

  const ventaId = generateId('vta');
  const folio = db.nextFolio++;
  const createdAt = new Date().toISOString();

  const detalles: DetalleVenta[] = resolvedItems.map(({ prod, cantidad, precio_unitario }) => ({
    id: generateId('det'),
    venta_id: ventaId,
    product_id: prod.id,
    sku: prod.sku,
    product_name: prod.name,
    cantidad,
    precio_unitario,
    subtotal: Number((cantidad * precio_unitario).toFixed(2)),
  }));

  const nuevaVenta: Venta = {
    id: ventaId,
    folio,
    warehouse_id: params.warehouse_id,
    cajero_id: params.profile.id,
    corte_id: openCorte?.id ?? null,
    cliente_nombre: params.cliente_nombre.trim() || 'Público General',
    metodo_pago: params.metodo_pago,
    monto_efectivo: Number(params.monto_efectivo) || 0,
    monto_transferencia: Number(params.monto_transferencia) || 0,
    monto_tarjeta: Number(params.monto_tarjeta) || 0,
    monto_recibido: Number(params.monto_recibido) || pagado,
    cambio,
    subtotal: Number(subtotal.toFixed(2)),
    descuento,
    total,
    status: 'completada',
    cancel_reason: null,
    cancelled_at: null,
    notas: params.notas,
    created_at: createdAt,
    detalle_ventas: detalles,
    cajero: {
      full_name: params.profile.full_name,
      email: params.profile.email,
    },
  };

  db.ventas.unshift(nuevaVenta);
  writeDb(db);

  return {
    venta_id: ventaId,
    folio,
    subtotal: nuevaVenta.subtotal,
    descuento: nuevaVenta.descuento,
    total: nuevaVenta.total,
    cambio: nuevaVenta.cambio,
    created_at: createdAt,
  };
}

export function cancelarVentaLocal(ventaId: string, motivo: string | null): void {
  const db = readDb();
  const venta = db.ventas.find((v) => v.id === ventaId);
  if (!venta) throw new Error('Venta no encontrada');
  if (venta.status === 'cancelada') throw new Error('Esta venta ya está cancelada');

  // Reintegrar existencias a la sucursal
  for (const det of venta.detalle_ventas ?? []) {
    const prod = db.products.find((p) => p.id === det.product_id);
    if (prod) {
      prod.stockByWarehouse[venta.warehouse_id] =
        Number(prod.stockByWarehouse[venta.warehouse_id] ?? 0) + det.cantidad;
    }
  }

  venta.status = 'cancelada';
  venta.cancel_reason = motivo?.trim() || null;
  venta.cancelled_at = new Date().toISOString();
  writeDb(db);
}

// --- HISTORIAL Y CORTES DE CAJA ---

export function getActiveCorteLocal(warehouseId: string): CorteCaja | null {
  const db = readDb();
  return db.cortes.find((c) => c.warehouse_id === warehouseId && c.status === 'abierto') ?? null;
}

export function getClosedCortesLocal(warehouseId: string, filterDate?: string): CorteCaja[] {
  const db = readDb();
  let list = db.cortes
    .filter((c) => c.warehouse_id === warehouseId && c.status === 'cerrado')
    .sort((a, b) => new Date(b.closed_at ?? 0).getTime() - new Date(a.closed_at ?? 0).getTime());

  if (filterDate) {
    const start = new Date(`${filterDate}T00:00:00`).getTime();
    const end = new Date(`${filterDate}T23:59:59.999`).getTime();
    list = list.filter((c) => {
      const t = new Date(c.closed_at ?? 0).getTime();
      return t >= start && t <= end;
    });
    return list;
  }

  return list.slice(0, 5);
}

export function getVentasByCorteLocal(warehouseId: string, corteId: string): Venta[] {
  const db = readDb();
  return db.ventas
    .filter((v) => v.warehouse_id === warehouseId && v.corte_id === corteId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getVentasByDateLocal(warehouseId: string, dateStr: string): Venta[] {
  const db = readDb();
  const start = new Date(`${dateStr}T00:00:00`).getTime();
  const end = new Date(`${dateStr}T23:59:59.999`).getTime();
  return db.ventas
    .filter((v) => {
      if (v.warehouse_id !== warehouseId) return false;
      const t = new Date(v.created_at).getTime();
      return t >= start && t <= end;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getCorteStatsLocal(corteId: string) {
  const db = readDb();
  const rows = db.ventas.filter((v) => v.corte_id === corteId && v.status === 'completada');
  return {
    efectivo: rows.reduce((s, r) => s + Number(r.monto_efectivo), 0),
    transferencia: rows.reduce((s, r) => s + Number(r.monto_transferencia), 0),
    tarjeta: rows.reduce((s, r) => s + Number(r.monto_tarjeta), 0),
    total: rows.reduce((s, r) => s + Number(r.total), 0),
    count: rows.length,
  };
}

export function openCorteLocal(warehouseId: string, userId: string, fondoInicial: number): CorteCaja {
  const db = readDb();
  const existing = db.cortes.find((c) => c.warehouse_id === warehouseId && c.status === 'abierto');
  if (existing) throw new Error('Ya existe un turno abierto en esta sucursal.');

  const corte: CorteCaja = {
    id: generateId('crt'),
    warehouse_id: warehouseId,
    opened_by: userId,
    closed_by: null,
    status: 'abierto',
    fondo_inicial: Math.max(0, Number(fondoInicial) || 0),
    total_efectivo: 0,
    total_transferencia: 0,
    total_tarjeta: 0,
    total_ventas: 0,
    efectivo_contado: null,
    diferencia: null,
    notas: null,
    opened_at: new Date().toISOString(),
    closed_at: null,
  };

  db.cortes.unshift(corte);
  writeDb(db);
  return corte;
}

export function closeCorteLocal(
  corteId: string,
  userId: string,
  efectivoContado: number,
  notas: string | null
): void {
  const db = readDb();
  const corte = db.cortes.find((c) => c.id === corteId);
  if (!corte) throw new Error('Corte no encontrado');

  const stats = getCorteStatsLocal(corteId);
  const esperado = Number(corte.fondo_inicial) + stats.efectivo;
  const contado = Math.max(0, Number(efectivoContado) || 0);

  corte.status = 'cerrado';
  corte.closed_by = userId;
  corte.closed_at = new Date().toISOString();
  corte.total_efectivo = stats.efectivo;
  corte.total_transferencia = stats.transferencia;
  corte.total_tarjeta = stats.tarjeta;
  corte.total_ventas = stats.total;
  corte.efectivo_contado = contado;
  corte.diferencia = Number((contado - esperado).toFixed(2));
  corte.notas = notas?.trim() || null;

  writeDb(db);
}

export function deleteCorteLocal(corteId: string): void {
  const db = readDb();
  const corte = db.cortes.find((c) => c.id === corteId);
  if (!corte) throw new Error('Corte no encontrado');
  if (corte.status !== 'cerrado') throw new Error('Cierra el turno antes de eliminarlo');

  for (const v of db.ventas) {
    if (v.corte_id === corteId) v.corte_id = null;
  }
  db.cortes = db.cortes.filter((c) => c.id !== corteId);
  writeDb(db);
}

// --- RESTAURAR DEMO ---

export function resetDemoData(): void {
  const fresh = createInitialDb();
  localStorage.setItem(STATE_KEY, JSON.stringify(fresh));

  // Limpiar borradores de carrito de todas las sucursales
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(DRAFT_PREFIX)) keysToRemove.push(k);
  }
  for (const k of keysToRemove) localStorage.removeItem(k);

  localStorage.removeItem(ACTIVE_WAREHOUSE_KEY);
  emitChange();
}
