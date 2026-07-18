/**
 * AUTO-GENERADO por Coongro Builder — NO editar a mano.
 * Se regenera al guardar la página de settings desde /dev/builder.
 * La lógica de negocio va en un hook de dominio que consume esto.
 */
/* eslint-disable */

import { useSettings } from '@coongro/plugin-sdk';

function toEnum<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

export const NEXT_DOSE_APPOINTMENT = {
  off: 'off',
  ask: 'ask',
  auto: 'auto',
} as const;

export const DOSE_REMINDER = {
  off: 'off',
  _1: '1',
  _3: '3',
  _7: '7',
} as const;

/** Tipo de cada setting por su key punteada (para getSetting). */
export interface VaccinationSettingsByKey {
  'vaccination.nextDoseAppointment': 'off' | 'ask' | 'auto';
  'vaccination.doseReminder': 'off' | '1' | '3' | '7';
}

/** Settings del plugin con defaults aplicados y coerción por tipo. */
export interface VaccinationSettings {
  /** Turno para próxima dosis — Al registrar una vacunación, controla si se ofrece agendar el turno de la próxima dosis automáticamente. · `vaccination.nextDoseAppointment` · default: `"ask"` */
  readonly nextDoseAppointment: 'off' | 'ask' | 'auto';
  /** Recordatorio de refuerzo — Avisar en la campana de Coongro cuando se acerca la fecha de la próxima dosis, para que la clínica contacte al tutor. El aviso llega al equipo (no al tutor). Default: sin recordatorio. · `vaccination.doseReminder` · default: `"off"` */
  readonly doseReminder: 'off' | '1' | '3' | '7';
}

/** Nombre de prop → key punteada del manifest. */
export const SETTING_KEYS = {
  nextDoseAppointment: 'vaccination.nextDoseAppointment',
  doseReminder: 'vaccination.doseReminder',
} as const;

/** Valores por defecto (los mismos del manifest). */
export const SETTING_DEFAULTS = {
  'vaccination.nextDoseAppointment': 'ask',
  'vaccination.doseReminder': 'off',
} as const;

const COERCE: {
  [K in keyof VaccinationSettingsByKey]: (
    values: Record<string, unknown>
  ) => VaccinationSettingsByKey[K];
} = {
  'vaccination.nextDoseAppointment': (values) =>
    toEnum(values['vaccination.nextDoseAppointment'], ['off', 'ask', 'auto'], 'ask'),
  'vaccination.doseReminder': (values) =>
    toEnum(values['vaccination.doseReminder'], ['off', '1', '3', '7'], 'off'),
};

/** Lee UNA setting tipada desde los valores crudos del tenant (para handlers). */
export function getSetting<K extends keyof VaccinationSettingsByKey>(
  values: Record<string, unknown>,
  key: K
): VaccinationSettingsByKey[K] {
  return COERCE[key](values);
}

/** Construye el objeto tipado desde los valores crudos (sin hook: handlers/tests). */
export function readVaccinationSettings(values: Record<string, unknown>): VaccinationSettings {
  return {
    nextDoseAppointment: COERCE['vaccination.nextDoseAppointment'](values),
    doseReminder: COERCE['vaccination.doseReminder'](values),
  };
}

/**
 * Hook reactivo: settings tipadas del plugin con defaults aplicados.
 * Envolvé esto en un hook de dominio si necesitás lógica de negocio.
 */
export function useVaccinationSettings(): { settings: VaccinationSettings; loading: boolean } {
  const { values, loading } = useSettings('vaccination.');
  return { settings: readVaccinationSettings(values), loading };
}
