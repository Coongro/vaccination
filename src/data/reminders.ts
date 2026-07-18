/**
 * Recordatorio de refuerzo de vacuna: al registrar una aplicación con fecha de
 * próxima dosis, agenda un aviso in-app para el EQUIPO de la clínica (campana de
 * Coongro, por-tenant — no llega al tutor) unos días antes del vencimiento.
 *
 * Reusa el motor de notificaciones agendadas del core (COONG-166) y el patrón de
 * COONG-251. Una aplicación es inmutable (no hay edit/delete), así que solo se
 * agenda al aplicar — no hace falta cancelar/reprogramar.
 */
import { settings, notifications } from '@coongro/plugin-sdk';

/** Input de `notifications.schedule`, derivado del SDK (no se exporta el tipo). */
type ScheduleInput = Parameters<typeof notifications.schedule>[0];

/** Módulo con el que se agenda (para agrupar en la campana). */
const MODULE_ID = 'vaccination';

/** setting vaccination.doseReminder → días de anticipación (off/valor inválido = null). */
const OFFSET_DAYS: Record<string, number> = { '1': 1, '3': 3, '7': 7 };

export interface DoseReminderContext {
  /** id de la aplicación (entidad del aviso). */
  appliedId: string;
  /** Fecha de la próxima dosis en `yyyy-mm-dd` (o null si no hay refuerzo). */
  nextDoseDateISO: string | null;
  petName?: string | null;
  vaccineName?: string | null;
}

/** Sufijo del mensaje con vacuna y/o mascota, sin template literals anidados. */
function reminderDetalle(vaccineName?: string | null, petName?: string | null): string {
  return [vaccineName, petName].filter(Boolean).join(' — ');
}

/**
 * Construye el input del recordatorio, o `null` si no corresponde
 * (recordatorio apagado, sin fecha de próxima dosis, o el momento ya pasó).
 * El aviso se agenda a las 09:00 (hora local) del día N días antes del refuerzo.
 */
export function buildDoseReminder(pref: string, ctx: DoseReminderContext): ScheduleInput | null {
  const days = OFFSET_DAYS[pref];
  if (!days || !ctx.nextDoseDateISO) return null;

  const doseAt = new Date(`${ctx.nextDoseDateISO}T09:00:00`);
  if (Number.isNaN(doseAt.getTime())) return null;

  const remindAt = new Date(doseAt.getTime() - days * 86_400_000);
  if (remindAt.getTime() <= Date.now()) return null; // el momento del aviso ya pasó

  const detalle = reminderDetalle(ctx.vaccineName, ctx.petName);
  return {
    scheduledAt: remindAt,
    title: 'Refuerzo de vacuna próximo',
    message: detalle ? `Refuerzo próximo — ${detalle}` : 'Un refuerzo de vacuna está por vencer.',
    level: 'info',
    entityId: ctx.appliedId,
    entityType: 'vaccination',
    motivo: 'vaccine-due',
    dedupKey: `vaccine-due:${ctx.appliedId}`,
  };
}

/**
 * Lee la setting `vaccination.doseReminder` y agenda el recordatorio si corresponde.
 * No-op silencioso si está apagado, no hay próxima dosis, o el aviso ya venció.
 * Se llama después de registrar la aplicación (best-effort: nunca la bloquea).
 */
export async function scheduleDoseReminderIfOn(ctx: DoseReminderContext): Promise<void> {
  try {
    const pref = (await settings.get<string>('vaccination.doseReminder')) ?? 'off';
    const reminder = buildDoseReminder(pref, ctx);
    if (!reminder) return;
    // El `notifications` standalone no inyecta moduleId (a diferencia de usePlugin);
    // lo pasamos explícito para que el aviso quede agrupado bajo 'vaccination'.
    await notifications.schedule({ ...reminder, moduleId: MODULE_ID } as ScheduleInput);
  } catch {
    /* best-effort: el recordatorio no bloquea la aplicación */
  }
}
