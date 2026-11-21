import { useState } from 'react';
import { Printer, X, CheckCircle2, Ban } from 'lucide-react';
import type { TicketData } from '../types/pos';
import { formatDateTime, formatFolio, formatMoney, metodoPagoLabel } from '../lib/format';

interface TicketModalProps {
  ticket: TicketData | null;
  onClose: () => void;
}

export function TicketModal({ ticket, onClose }: TicketModalProps) {
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');

  if (!ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto">
        {/* Barra superior (oculta al imprimir) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 no-print">
          <div className="flex items-center gap-2">
            {ticket.status === 'cancelada' ? (
              <Ban className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Ticket {formatFolio(ticket.folio)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-zinc-200/70 dark:bg-zinc-800 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  paperSize === '80mm'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  paperSize === '58mm'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                58mm
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Vista previa + área imprimible */}
        <div className="p-5 bg-zinc-100 dark:bg-zinc-950/60 flex justify-center max-h-[70vh] overflow-y-auto">
          <div
            id="ticket-print-area"
            className={`bg-white text-zinc-950 font-mono text-xs leading-relaxed p-4 rounded-lg shadow-sm border border-zinc-200 w-full ${
              paperSize === '58mm' ? 'max-w-[230px] ticket-58mm' : 'max-w-[320px]'
            }`}
          >
            {/* Encabezado */}
            <div className="text-center border-b border-dashed border-zinc-400 pb-2.5 mb-2.5">
              <div className="font-bold text-sm tracking-wide uppercase">
                VENTAS POS
              </div>
              <div className="font-semibold text-[11px] mt-0.5">
                Sucursal: {ticket.warehouse.name}
              </div>
              {ticket.warehouse.address && (
                <div className="text-[10px] text-zinc-600">{ticket.warehouse.address}</div>
              )}
              {ticket.warehouse.city && (
                <div className="text-[10px] text-zinc-600">{ticket.warehouse.city}</div>
              )}
              {ticket.status === 'cancelada' && (
                <div className="mt-1.5 py-0.5 border border-black font-bold text-[11px] uppercase">
                  *** VENTA CANCELADA ***
                </div>
              )}
            </div>

            {/* Metadatos */}
            <div className="space-y-0.5 text-[11px] border-b border-dashed border-zinc-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span>Folio:</span>
                <span className="font-bold">{formatFolio(ticket.folio)}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha:</span>
                <span>{formatDateTime(ticket.created_at)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Cajero:</span>
                <span className="truncate text-right">{ticket.cajero_nombre}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Cliente:</span>
                <span className="truncate text-right">{ticket.cliente_nombre}</span>
              </div>
            </div>

            {/* Conceptos */}
            <div className="border-b border-dashed border-zinc-400 pb-2 mb-2">
              <div className="flex justify-between font-bold text-[10px] uppercase border-b border-zinc-300 pb-1 mb-1">
                <span>Cant · Producto</span>
                <span>Importe</span>
              </div>
              <div className="space-y-1.5">
                {ticket.items.map((item, idx) => (
                  <div key={`${item.sku}-${idx}`}>
                    <div className="font-semibold leading-snug">{item.product_name}</div>
                    <div className="flex justify-between text-[11px] text-zinc-700">
                      <span>
                        {item.cantidad} x {formatMoney(item.precio_unitario)}
                      </span>
                      <span className="font-semibold text-zinc-950 tabular-nums">
                        {formatMoney(item.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="space-y-0.5 text-[11px] border-b border-dashed border-zinc-400 pb-2 mb-2 tabular-nums">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatMoney(ticket.subtotal)}</span>
              </div>
              {ticket.descuento > 0 && (
                <div className="flex justify-between">
                  <span>Descuento:</span>
                  <span>-{formatMoney(ticket.descuento)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-zinc-300">
                <span>TOTAL:</span>
                <span>{formatMoney(ticket.total)}</span>
              </div>
            </div>

            {/* Pago */}
            <div className="space-y-0.5 text-[11px] border-b border-dashed border-zinc-400 pb-2 mb-2 tabular-nums">
              <div className="flex justify-between">
                <span>Método:</span>
                <span className="font-semibold">{metodoPagoLabel(ticket.metodo_pago)}</span>
              </div>
              {ticket.monto_efectivo > 0 && (
                <div className="flex justify-between">
                  <span>Efectivo:</span>
                  <span>{formatMoney(ticket.monto_efectivo)}</span>
                </div>
              )}
              {ticket.monto_transferencia > 0 && (
                <div className="flex justify-between">
                  <span>Transferencia:</span>
                  <span>{formatMoney(ticket.monto_transferencia)}</span>
                </div>
              )}
              {ticket.monto_tarjeta > 0 && (
                <div className="flex justify-between">
                  <span>Tarjeta:</span>
                  <span>{formatMoney(ticket.monto_tarjeta)}</span>
                </div>
              )}
              {ticket.monto_recibido > 0 &&
                (ticket.metodo_pago === 'efectivo' || ticket.metodo_pago === 'mixto') && (
                  <div className="flex justify-between">
                    <span>Recibido:</span>
                    <span>{formatMoney(ticket.monto_recibido)}</span>
                  </div>
                )}
              {ticket.cambio > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Cambio:</span>
                  <span>{formatMoney(ticket.cambio)}</span>
                </div>
              )}
            </div>

            {ticket.notas && (
              <div className="text-[10px] text-zinc-700 mb-2">
                <span className="font-semibold">Nota:</span> {ticket.notas}
              </div>
            )}

            <div className="text-center text-[10px] text-zinc-600 pt-1">
              ¡Gracias por su preferencia!
              <br />
              Comprobante de venta interno
            </div>
          </div>
        </div>

        {/* Botones de acción (ocultos al imprimir) */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
