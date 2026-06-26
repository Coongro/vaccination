/**
 * Helpers de fecha para vencimientos de lote (date-key yyyy-mm-dd), independientes
 * del modelo de datos. Antes vivían en lote-status.ts (modelo viejo de lotes por
 * variante); quedaron acá al unificar los lotes en products.batches (COONG-220).
 */

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Días hasta el vencimiento (negativo = ya vencido). null si no hay fecha válida. */
export function daysUntil(expiresAt: string): number | null {
  if (!expiresAt) return null;
  const [y, m, d] = expiresAt.split('-').map(Number);
  if (!y || !m || !d) return null;
  const exp = new Date(y, m - 1, d);
  return Math.round((exp.getTime() - todayMidnight().getTime()) / 86400000);
}

/** Formatea una date-key yyyy-mm-dd como dd/mm/aaaa (o '—' si falta). */
export function formatDate(expiresAt: string): string {
  if (!expiresAt) return '—';
  const [y, m, d] = expiresAt.split('-');
  if (!y || !m || !d) return expiresAt;
  return `${d}/${m}/${y}`;
}
