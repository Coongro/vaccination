/**
 * Lectura de los settings del plugin de vacunación (hook de dominio).
 * Delega el modo de agendado a la capa tipada generada (`settings.gen.ts`).
 */
import { useSettings } from '@coongro/plugin-sdk';

import { readVaccinationSettings } from '../settings/settings.gen.js';

/** Comportamiento al registrar una aplicación respecto al turno de la próxima dosis. */
export type NextDoseAppointmentMode = 'off' | 'ask' | 'auto';

/**
 * Prefills FIJOS del diálogo de próxima dosis. Ya NO son settings: la hora y la
 * duración reales las elige el veterinario al agendar (el diálogo tiene TimePicker
 * + sugerencia de slot libre). Antes eran dos enums que redefinían conceptos de la
 * agenda (`appointments.agenda.*`) — se quitaron en COONG-248.
 */
const DEFAULT_NEXT_DOSE_TIME = '09:00';
const DEFAULT_NEXT_DOSE_DURATION = 15;

export interface VaccinationSettings {
  /**
   * Cómo agendar el turno de la próxima dosis al aplicar una vacuna:
   * - `off`  → solo se calcula la fecha; el turno se agenda manual desde Próximas dosis.
   * - `ask`  → tras aplicar, se ofrece agendar el turno (default).
   * - `auto` → se agenda el turno automáticamente.
   */
  nextDoseMode: NextDoseAppointmentMode;
  /** Hora de inicio prefill (HH:mm) del turno de próxima dosis. */
  nextDoseTime: string;
  /** Duración prefill (minutos) del turno — la hora de fin = inicio + esto. */
  nextDoseDuration: number;
}

export function useVaccinationSettings(): VaccinationSettings {
  const { values } = useSettings('vaccination.');
  const { nextDoseAppointment } = readVaccinationSettings(values);
  return {
    nextDoseMode: nextDoseAppointment,
    nextDoseTime: DEFAULT_NEXT_DOSE_TIME,
    nextDoseDuration: DEFAULT_NEXT_DOSE_DURATION,
  };
}
