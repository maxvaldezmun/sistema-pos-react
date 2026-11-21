const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  return currencyFormatter.format(Number.isFinite(num) ? num : 0);
}

export function formatFolio(folio: number): string {
  return `#${String(folio).padStart(6, '0')}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function getTodayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function metodoPagoLabel(metodo: string): string {
  switch (metodo) {
    case 'efectivo':
      return 'Efectivo';
    case 'transferencia':
      return 'Transferencia';
    case 'tarjeta':
      return 'Tarjeta';
    case 'mixto':
      return 'Mixto';
    default:
      return metodo;
  }
}
