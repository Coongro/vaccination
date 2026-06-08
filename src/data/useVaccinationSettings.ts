/**
 * Lectura de los settings del plugin de vacunación.
 * Usa useSettings del SDK para reactividad automática.
 */
import { useSettings } from '@coongro/plugin-sdk';

/** Comportamiento al registrar una aplicación respecto al turno de la próxima dosis. */
export type NextDoseAppointmentMode = 'off' | 'ask' | 'auto';

/** Hora por defecto (HH:mm) si el setting no está seteado. */
const DEFAULT_NEXT_DOSE_TIME = '09:00';
/** Duración por defecto (min) si el setting no está seteado. */
const DEFAULT_NEXT_DOSE_DURATION = 15;

export interface VaccinationSettings {
  /**
   * Cómo agendar el turno de la próxima dosis al aplicar una vacuna:
   * - `off`  → solo se calcula la fecha; el turno se agenda manual desde Próximas dosis.
   * - `ask`  → tras aplicar, se ofrece agendar el turno (default).
   * - `auto` → se agenda el turno automáticamente.
   */
  nextDoseMode: NextDoseAppointmentMode;
  /** Hora de inicio preferida (HH:mm) del turno de próxima dosis. */
  nextDoseTime: string;
  /** Duración por defecto (minutos) del turno — la hora de fin = inicio + esto. */
  nextDoseDuration: number;
}

export function useVaccinationSettings(): VaccinationSettings {
  const { values } = useSettings('vaccination.');
  const mode = values['vaccination.nextDoseAppointment'];
  const time = values['vaccination.nextDoseDefaultTime'];
  const duration = Number(values['vaccination.nextDoseDefaultDuration']);
  return {
    nextDoseMode: mode === 'off' || mode === 'auto' ? mode : 'ask',
    nextDoseTime:
      typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_NEXT_DOSE_TIME,
    nextDoseDuration:
      Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_NEXT_DOSE_DURATION,
  };
}
