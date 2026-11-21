import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Ban,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Download,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  cancelarVentaLocal,
  closeCorteLocal,
  deleteCorteLocal,
  getActiveCorteLocal,
  getClosedCortesLocal,
  getCorteStatsLocal,
  getVentasByCorteLocal,
  getVentasByDateLocal,
  openCorteLocal,
  subscribePosChanges,
} from '../services/localPosService';
import { isAdminOrTi, type CorteCaja, type Profile, type TicketData, type Venta, type Warehouse } from '../types/pos';
import { downloadExcelCsv } from '../lib/exportExcel';
import {
  formatDateTime,
  formatFolio,
  formatMoney,
  formatTime,
  getTodayLocalDate,
  metodoPagoLabel,
} from '../lib/format';

interface HistoryCutViewProps {
  warehouse: Warehouse;
  profile: Profile;
  onReprintTicket: (ticket: TicketData) => void;
}

export function HistoryCutView({
  warehouse,
  profile,
  onReprintTicket,
}: HistoryCutViewProps) {
  const [viewMode, setViewMode] = useState<'turno' | 'fecha'>('turno');
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate());
  const [corteFilterDate, setCorteFilterDate] = useState('');
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [activeCorte, setActiveCorte] = useState<CorteCaja | null>(null);
  const [closedCortes, setClosedCortes] = useState<CorteCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedVentaId, setExpandedVentaId] = useState<string | null>(null);

  // Abrir / Cerrar corte
  const [fondoInicial, setFondoInicial] = useState('0');
  const [efectivoContado, setEfectivoContado] = useState('');
  const [corteNotas, setCorteNotas] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [corteLoading, setCorteLoading] = useState(false);

  // Cancelar venta
  const [cancelTarget, setCancelTarget] = useState<Venta | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Eliminar corte cerrado (solo admin / ti)
  const [deletingCorteId, setDeletingCorteId] = useState<string | null>(null);
  const canDeleteCortes = isAdminOrTi(profile.role);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const openCorte = getActiveCorteLocal(warehouse.id);
      const closed = getClosedCortesLocal(warehouse.id, corteFilterDate || undefined);
      setActiveCorte(openCorte);
      setClosedCortes(closed);

      if (viewMode === 'turno') {
        setVentas(openCorte ? getVentasByCorteLocal(warehouse.id, openCorte.id) : []);
      } else {
        setVentas(getVentasByDateLocal(warehouse.id, selectedDate));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando historial');
    } finally {
      setLoading(false);
    }
  }, [warehouse.id, selectedDate, viewMode, corteFilterDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return subscribePosChanges(() => {
      loadData();
    });
  }, [loadData]);

  // Totales del día seleccionado (solo ventas completadas)
  const daySummary = useMemo(() => {
    const completadas = ventas.filter((v) => v.status === 'completada');
    const canceladas = ventas.filter((v) => v.status === 'cancelada');

    const totalEfectivo = completadas.reduce((s, v) => s + Number(v.monto_efectivo), 0);
    const totalTransferencia = completadas.reduce(
      (s, v) => s + Number(v.monto_transferencia),
      0
    );
    const totalTarjeta = completadas.reduce((s, v) => s + Number(v.monto_tarjeta), 0);
    const totalVentas = completadas.reduce((s, v) => s + Number(v.total), 0);

    return {
      countCompletadas: completadas.length,
      countCanceladas: canceladas.length,
      totalEfectivo,
      totalTransferencia,
      totalTarjeta,
      totalVentas,
    };
  }, [ventas]);

  // Totales específicos del corte abierto (si existe)
  const [corteVentasStats, setCorteVentasStats] = useState({
    efectivo: 0,
    transferencia: 0,
    tarjeta: 0,
    total: 0,
    count: 0,
  });

  useEffect(() => {
    if (!activeCorte) {
      setCorteVentasStats({ efectivo: 0, transferencia: 0, tarjeta: 0, total: 0, count: 0 });
      return;
    }
    setCorteVentasStats(getCorteStatsLocal(activeCorte.id));
  }, [activeCorte, ventas]);

  const handleOpenCorte = async () => {
    setCorteLoading(true);
    setError(null);
    try {
      openCorteLocal(warehouse.id, profile.id, Math.max(0, Number(fondoInicial) || 0));
      setFondoInicial('0');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al abrir turno');
    } finally {
      setCorteLoading(false);
    }
  };

  const handleCloseCorte = async () => {
    if (!activeCorte) return;
    setCorteLoading(true);
    setError(null);
    try {
      closeCorteLocal(
        activeCorte.id,
        profile.id,
        Math.max(0, Number(efectivoContado) || 0),
        corteNotas.trim() || null
      );
      setShowCloseModal(false);
      setEfectivoContado('');
      setCorteNotas('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar corte');
    } finally {
      setCorteLoading(false);
    }
  };

  const handleDeleteCorte = async (corte: CorteCaja) => {
    const fecha = corte.closed_at ? formatDateTime(corte.closed_at) : 'este corte';
    if (
      !window.confirm(
        `¿Eliminar el corte cerrado del ${fecha} (${formatMoney(corte.total_ventas)})? Las ventas individuales se conservan.`
      )
    ) {
      return;
    }

    setDeletingCorteId(corte.id);
    setError(null);
    try {
      deleteCorteLocal(corte.id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar corte');
    } finally {
      setDeletingCorteId(null);
    }
  };

  const handleCancelVenta = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setError(null);
    try {
      cancelarVentaLocal(cancelTarget.id, cancelReason.trim() || null);
      setCancelTarget(null);
      setCancelReason('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar venta');
    } finally {
      setCancelling(false);
    }
  };

  const handleExportVentas = () => {
    if (ventas.length === 0) return;
    const slug = warehouse.name.toLowerCase().replace(/\s+/g, '_');
    const suffix = viewMode === 'turno' ? 'turno_actual' : selectedDate;
    downloadExcelCsv(
      `ventas_${slug}_${suffix}.csv`,
      [
        'Folio',
        'Fecha y Hora',
        'Sucursal',
        'Cliente',
        'Cajero',
        'Método de Pago',
        'Efectivo',
        'Transferencia',
        'Tarjeta',
        'Subtotal',
        'Descuento',
        'Total',
        'Estatus',
        'Motivo Cancelación',
      ],
      ventas.map((v) => [
        formatFolio(v.folio),
        formatDateTime(v.created_at),
        warehouse.name,
        v.cliente_nombre,
        v.cajero?.full_name || v.cajero?.email || '',
        metodoPagoLabel(v.metodo_pago),
        Number(v.monto_efectivo).toFixed(2),
        Number(v.monto_transferencia).toFixed(2),
        Number(v.monto_tarjeta).toFixed(2),
        Number(v.subtotal).toFixed(2),
        Number(v.descuento).toFixed(2),
        Number(v.total).toFixed(2),
        v.status,
        v.cancel_reason ?? '',
      ])
    );
  };

  const handleExportCortes = () => {
    if (closedCortes.length === 0) return;
    const slug = warehouse.name.toLowerCase().replace(/\s+/g, '_');
    const suffix = corteFilterDate || 'ultimos_5';
    downloadExcelCsv(
      `cortes_${slug}_${suffix}.csv`,
      [
        'Sucursal',
        'Apertura',
        'Cierre',
        'Fondo Inicial',
        'Efectivo',
        'Transferencia',
        'Tarjeta',
        'Total Ventas',
        'Efectivo Contado',
        'Diferencia',
        'Notas',
      ],
      closedCortes.map((c) => [
        warehouse.name,
        formatDateTime(c.opened_at),
        c.closed_at ? formatDateTime(c.closed_at) : '',
        Number(c.fondo_inicial).toFixed(2),
        Number(c.total_efectivo).toFixed(2),
        Number(c.total_transferencia).toFixed(2),
        Number(c.total_tarjeta).toFixed(2),
        Number(c.total_ventas).toFixed(2),
        Number(c.efectivo_contado ?? 0).toFixed(2),
        Number(c.diferencia ?? 0).toFixed(2),
        c.notas ?? '',
      ])
    );
  };

  const handleReprint = (v: Venta) => {
    const ticket: TicketData = {
      folio: v.folio,
      created_at: v.created_at,
      warehouse,
      cajero_nombre: v.cajero?.full_name || v.cajero?.email || 'Cajero',
      cliente_nombre: v.cliente_nombre,
      metodo_pago: v.metodo_pago,
      monto_efectivo: Number(v.monto_efectivo),
      monto_transferencia: Number(v.monto_transferencia),
      monto_tarjeta: Number(v.monto_tarjeta),
      monto_recibido: Number(v.monto_recibido),
      cambio: Number(v.cambio),
      subtotal: Number(v.subtotal),
      descuento: Number(v.descuento),
      total: Number(v.total),
      status: v.status,
      notas: v.notas,
      items: (v.detalle_ventas ?? []).map((d) => ({
        sku: d.sku,
        product_name: d.product_name,
        cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario),
        subtotal: Number(d.subtotal),
      })),
    };
    onReprintTicket(ticket);
  };

  const efectivoEsperadoCorte = activeCorte
    ? Number(activeCorte.fondo_inicial) + corteVentasStats.efectivo
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-5 space-y-5">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* BLOQUE 1: Turno / Corte de Caja */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {activeCorte ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <Unlock className="w-3.5 h-3.5" />
                  Turno Abierto
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <Lock className="w-3.5 h-3.5" />
                  Caja Cerrada
                </span>
              )}
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Corte de Caja · {warehouse.name}
              </h2>
            </div>

            {activeCorte ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Abierto: {formatDateTime(activeCorte.opened_at)} · Fondo inicial:{' '}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {formatMoney(activeCorte.fondo_inicial)}
                </strong>{' '}
                · Efectivo esperado en caja:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {formatMoney(efectivoEsperadoCorte)}
                </strong>{' '}
                ({corteVentasStats.count} ventas en turno)
              </p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Abre un turno con el fondo inicial para llevar el control exacto de tu corte.
              </p>
            )}
          </div>

          {activeCorte ? (
            <button
              type="button"
              onClick={() => {
                setEfectivoContado(efectivoEsperadoCorte.toFixed(2));
                setShowCloseModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 dark:hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Lock className="w-4 h-4" />
              Realizar Corte de Caja
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="text-xs text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2">
                  Fondo $
                </span>
                <input
                  type="number"
                  min={0}
                  step="10"
                  value={fondoInicial}
                  onChange={(e) => setFondoInicial(e.target.value)}
                  className="w-36 pl-16 pr-3 py-2 text-right text-sm tabular-nums rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                disabled={corteLoading}
                onClick={handleOpenCorte}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
              >
                {corteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Abrir Turno
              </button>
            </div>
          )}
        </div>
      </section>

      {/* BLOQUE 2: Resumen por método de pago (Turno Actual o Por Fecha) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {viewMode === 'turno' ? 'Resumen del Turno Actual' : 'Resumen de Ventas por Fecha'}
            </h2>
            <div className="flex rounded-xl bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('turno')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'turno'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Turno actual
              </button>
              <button
                type="button"
                onClick={() => setViewMode('fecha')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'fecha'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Por fecha
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'fecha' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
              />
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 cursor-pointer"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Total Vendido</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {formatMoney(daySummary.totalVentas)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              {daySummary.countCompletadas} completadas · {daySummary.countCanceladas} canceladas
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Efectivo</span>
              <Banknote className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
              {formatMoney(daySummary.totalEfectivo)}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Transferencia</span>
              <ArrowLeftRight className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
              {formatMoney(daySummary.totalTransferencia)}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Tarjeta</span>
              <CreditCard className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
              {formatMoney(daySummary.totalTarjeta)}
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 3: Tabla de ventas del día */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Ventas Registradas ({ventas.length})
          </h3>
          {ventas.length > 0 && (
            <button
              type="button"
              onClick={handleExportVentas}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Excel
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : ventas.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            {viewMode === 'turno'
              ? activeCorte
                ? `Aún no hay ventas registradas en el turno actual de ${warehouse.name}.`
                : `Caja cerrada. Abre un turno para iniciar el registro de ventas en ${warehouse.name}.`
              : `No hay ventas registradas para esta fecha en ${warehouse.name}.`}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ventas.map((v) => {
              const expanded = expandedVentaId === v.id;
              const isCancelled = v.status === 'cancelada';

              return (
                <div key={v.id} className={isCancelled ? 'bg-red-50/40 dark:bg-red-950/15' : ''}>
                  <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setExpandedVentaId(expanded ? null : v.id)}
                        className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
                      >
                        {expanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                            {formatFolio(v.folio)}
                          </span>
                          {isCancelled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 uppercase">
                              Cancelada
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 uppercase">
                              {metodoPagoLabel(v.metodo_pago)}
                            </span>
                          )}
                          <span className="text-xs text-zinc-500">
                            {formatTime(v.created_at)}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {v.cliente_nombre} · Cajero:{' '}
                          {v.cajero?.full_name || v.cajero?.email || '—'}
                          {v.cancel_reason && (
                            <span className="text-red-600 dark:text-red-400">
                              {' '}
                              · Motivo: {v.cancel_reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <span
                        className={`text-base font-bold tabular-nums mr-2 ${
                          isCancelled
                            ? 'line-through text-zinc-400'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {formatMoney(v.total)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleReprint(v)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Ticket
                      </button>

                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-12 pb-3 text-xs">
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 uppercase text-[10px]">
                            <tr>
                              <th className="px-3 py-1.5">SKU</th>
                              <th className="px-3 py-1.5">Producto</th>
                              <th className="px-3 py-1.5 text-right">Cant.</th>
                              <th className="px-3 py-1.5 text-right">P. Unit</th>
                              <th className="px-3 py-1.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
                            {(v.detalle_ventas ?? []).map((d) => (
                              <tr key={d.id}>
                                <td className="px-3 py-1.5 font-mono text-zinc-500">{d.sku}</td>
                                <td className="px-3 py-1.5 font-medium">{d.product_name}</td>
                                <td className="px-3 py-1.5 text-right">{d.cantidad}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {formatMoney(d.precio_unitario)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-semibold">
                                  {formatMoney(d.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOQUE 4: Cortes cerrados (últimos 5 o filtrados por fecha) */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {corteFilterDate ? `Cortes Cerrados (${corteFilterDate})` : 'Últimos 5 Cortes Cerrados'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCorteFilterDate('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                !corteFilterDate
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500'
              }`}
            >
              Últimos 5
            </button>

            <input
              type="date"
              value={corteFilterDate}
              onChange={(e) => setCorteFilterDate(e.target.value)}
              title="Buscar corte por fecha"
              className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            />

            {closedCortes.length > 0 && (
              <button
                type="button"
                onClick={handleExportCortes}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>
            )}
          </div>
        </div>

        {closedCortes.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            {corteFilterDate
              ? `No hay cortes cerrados el ${corteFilterDate} en ${warehouse.name}.`
              : `Aún no hay cortes cerrados en ${warehouse.name}.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left tabular-nums">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Cierre</th>
                  <th className="px-4 py-2.5 text-right">Fondo</th>
                  <th className="px-4 py-2.5 text-right">Efectivo</th>
                  <th className="px-4 py-2.5 text-right">Transf.</th>
                  <th className="px-4 py-2.5 text-right">Tarjeta</th>
                  <th className="px-4 py-2.5 text-right">Total Ventas</th>
                  <th className="px-4 py-2.5 text-right">Contado</th>
                  <th className="px-4 py-2.5 text-right">Diferencia</th>
                  {canDeleteCortes && <th className="px-4 py-2.5 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {closedCortes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5">
                      {c.closed_at ? formatDateTime(c.closed_at) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(c.fondo_inicial)}</td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(c.total_efectivo)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatMoney(c.total_transferencia)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(c.total_tarjeta)}</td>
                    <td className="px-4 py-2.5 text-right font-bold">
                      {formatMoney(c.total_ventas)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {formatMoney(c.efectivo_contado)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-bold ${
                        Number(c.diferencia ?? 0) === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : Number(c.diferencia ?? 0) < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatMoney(c.diferencia)}
                    </td>
                    {canDeleteCortes && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={deletingCorteId === c.id}
                          onClick={() => handleDeleteCorte(c)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 cursor-pointer transition-colors"
                          title="Eliminar corte"
                        >
                          {deletingCorteId === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL: Cerrar Corte de Caja */}
      {showCloseModal && activeCorte && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Cerrar Corte de Caja
              </h3>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-zinc-500">Fondo inicial:</span>
                <span>{formatMoney(activeCorte.fondo_inicial)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ventas en efectivo:</span>
                <span>{formatMoney(corteVentasStats.efectivo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Transferencias:</span>
                <span>{formatMoney(corteVentasStats.transferencia)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tarjeta:</span>
                <span>{formatMoney(corteVentasStats.tarjeta)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
                <span>Efectivo esperado en caja:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {formatMoney(efectivoEsperadoCorte)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Efectivo físico contado ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.50"
                  value={efectivoContado}
                  onChange={(e) => setEfectivoContado(e.target.value)}
                  className="w-full px-3 py-2 text-right font-bold text-base tabular-nums rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
                {efectivoContado !== '' && (
                  <div className="text-xs mt-1.5 flex justify-between tabular-nums">
                    <span className="text-zinc-500">Diferencia:</span>
                    <span
                      className={`font-bold ${
                        Number(efectivoContado) - efectivoEsperadoCorte === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : Number(efectivoContado) - efectivoEsperadoCorte < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {formatMoney(Number(efectivoContado) - efectivoEsperadoCorte)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Observaciones (opcional)
                </label>
                <input
                  type="text"
                  value={corteNotas}
                  onChange={(e) => setCorteNotas(e.target.value)}
                  placeholder="Ej. Todo cuadrado sin novedades"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={corteLoading}
                onClick={handleCloseCorte}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                {corteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cancelar Venta */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-red-600 dark:text-red-400 flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Cancelar Venta {formatFolio(cancelTarget.folio)}
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Se revertirán las hojas al inventario de <strong>{warehouse.name}</strong> y se
              registrará el movimiento en bitácora. Total: <strong>{formatMoney(cancelTarget.total)}</strong>.
            </p>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Motivo de cancelación
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. Error en producto o cambio de pedido"
                className="w-full px-3 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelVenta}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Sí, Cancelar Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
