/* getHostUI() llega como tipo `error` en este archivo .ts (resolución de tipos de eslint;
   tsc compila bien). Los accesos a UI.* son seguros en runtime — silenciamos el falso positivo. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

const UI = getHostUI();
const React = getHostReact();
const h = React.createElement;

/**
 * Un lote es una variante de `@coongro/products` (reuso del inventario): el stock
 * vive en `variant.stock_current` y los metadatos del frasco en `variant.attributes`.
 * Esta es la forma normalizada que consume la vista de Lotes.
 */
export interface BatchItem {
  variantId: string;
  productId: string;
  productName: string;
  labName: string;
  lote: string;
  expiresAt: string; // yyyy-mm-dd
  received: number; // dosis cargadas (attributes.received)
  remaining: number; // dosis restantes (stock_current)
  applied: number; // received - remaining
  notes: string | null;
  isActive: boolean;
}

/** Estado derivado del lote. `por-vencer` incluye los días restantes para el label. */
export type BatchStatus =
  | 'activo'
  | 'vencido'
  | 'agotado'
  | 'baja'
  | { kind: 'por-vencer'; days: number };

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function daysUntil(expiresAt: string): number | null {
  if (!expiresAt) return null;
  const [y, m, d] = expiresAt.split('-').map(Number);
  if (!y || !m || !d) return null;
  const exp = new Date(y, m - 1, d);
  return Math.round((exp.getTime() - todayMidnight().getTime()) / 86400000);
}

export function formatDate(expiresAt: string): string {
  if (!expiresAt) return '—';
  const [y, m, d] = expiresAt.split('-');
  if (!y || !m || !d) return expiresAt;
  return `${d}/${m}/${y}`;
}

/** Prioridad: baja > agotado > vencido > por-vencer(30) > activo. */
export function computeBatchStatus(batch: BatchItem): BatchStatus {
  if (!batch.isActive) return 'baja';
  if (batch.remaining <= 0) return 'agotado';
  const days = daysUntil(batch.expiresAt);
  if (days !== null) {
    if (days < 0) return 'vencido';
    if (days <= 30) return { kind: 'por-vencer', days };
  }
  return 'activo';
}

/** True si el lote se puede usar para aplicar (activo o por vencer, con stock). */
export function isUsable(status: BatchStatus): boolean {
  return status === 'activo' || (typeof status === 'object' && status.kind === 'por-vencer');
}

export function statusBadge(status: BatchStatus): unknown {
  if (status === 'activo') return h(UI.Badge, { variant: 'success' } as any, 'Activo');
  if (status === 'vencido') return h(UI.Badge, { variant: 'danger' } as any, 'Vencido');
  if (status === 'agotado') return h(UI.Badge, { variant: 'secondary' } as any, 'Agotado');
  if (status === 'baja') return h(UI.Badge, { variant: 'secondary' } as any, 'Dado de baja');
  // por-vencer
  const label =
    status.days <= 0
      ? 'Vence hoy'
      : status.days === 1
        ? 'Vence mañana'
        : `Vence en ${status.days} días`;
  return h(UI.Badge, { variant: 'warning' } as any, label);
}
