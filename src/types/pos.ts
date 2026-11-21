export type UserRole = 'admin' | 'ti' | 'encargado' | 'sucursal_consulta';

export function isAdminOrTi(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'ti';
}

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'mixto';

export interface Warehouse {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
  is_pos_enabled?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  assigned_warehouse_id: string | null;
}

export interface ProductWithStock {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  dimensions: string | null;
  thickness_mm: number | null;
  sheets_per_bundle: number | null;
  min_stock_sheets: number | null;
  precio_venta: number;
  stock: number;
}

export interface CartItem {
  product: ProductWithStock;
  cantidad: number;
  precio_unitario: number;
}

export interface DetalleVenta {
  id: string;
  venta_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Venta {
  id: string;
  folio: number;
  warehouse_id: string;
  cajero_id: string;
  corte_id: string | null;
  cliente_nombre: string;
  metodo_pago: MetodoPago;
  monto_efectivo: number;
  monto_transferencia: number;
  monto_tarjeta: number;
  monto_recibido: number;
  cambio: number;
  subtotal: number;
  descuento: number;
  total: number;
  status: 'completada' | 'cancelada';
  cancel_reason: string | null;
  cancelled_at: string | null;
  notas: string | null;
  created_at: string;
  detalle_ventas?: DetalleVenta[];
  cajero?: { full_name: string | null; email: string } | null;
}

export interface CorteCaja {
  id: string;
  warehouse_id: string;
  opened_by: string;
  closed_by: string | null;
  status: 'abierto' | 'cerrado';
  fondo_inicial: number;
  total_efectivo: number;
  total_transferencia: number;
  total_tarjeta: number;
  total_ventas: number;
  efectivo_contado: number | null;
  diferencia: number | null;
  notas: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface TicketData {
  folio: number;
  created_at: string;
  warehouse: Warehouse;
  cajero_nombre: string;
  cliente_nombre: string;
  metodo_pago: MetodoPago;
  monto_efectivo: number;
  monto_transferencia: number;
  monto_tarjeta: number;
  monto_recibido: number;
  cambio: number;
  subtotal: number;
  descuento: number;
  total: number;
  status?: 'completada' | 'cancelada';
  notas?: string | null;
  items: {
    sku: string;
    product_name: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}
