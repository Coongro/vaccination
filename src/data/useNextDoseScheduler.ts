import { useTenantTimezone } from '@coongro/calendar';
import { getHostReact, views, createToastApi } from '@coongro/plugin-sdk';

import { formatDate } from '../components/date-utils.js';
import type { ScheduleInput } from '../components/ScheduleNextDoseDialog.js';

import {
  scheduleNextDoseAppointment,
  suggestFreeSlot,
  addMinutesToTime,
} from './useVaccinationData.js';
import { useVaccinationSettings } from './useVaccinationSettings.js';

const React = getHostReact();
const { useState, useCallback } = React;

const MODULE_ID = '@coongro/vaccination';

// Toast del SDK con el moduleId pre-inyectado (standalone, no requiere contexto).
const toast = createToastApi(MODULE_ID);

/**
 * Orquesta el agendado de la próxima dosis para las vistas:
 * - `openSchedule(input)`  → abre el diálogo (fecha + inicio + fin editables). Lo
 *   usa el botón "Agendar" (worklist + detalle) y el modo "ask" del setting.
 * - `scheduleAuto(input)`  → agenda en silencio: inicio en el primer hueco libre,
 *   fin = inicio + duración del setting. Modo "auto".
 * - `verTurno(dateKey)`    → abre la agenda en el día del turno.
 * - `scheduleDialogProps`  → props para renderizar <ScheduleNextDoseDialog/> una vez.
 *
 * `reload` refresca la vista que la consume tras agendar.
 */
export function useNextDoseScheduler(reload: () => Promise<void>) {
  const tz = useTenantTimezone();
  const { nextDoseTime, nextDoseDuration } = useVaccinationSettings();
  const [scheduleInput, setScheduleInput] = useState<ScheduleInput | null>(null);

  const openSchedule = useCallback((input: ScheduleInput) => setScheduleInput(input), []);
  const closeSchedule = useCallback(() => setScheduleInput(null), []);

  const scheduleAuto = useCallback(
    async (input: ScheduleInput) => {
      if (!input.contactId) return;
      try {
        const time = await suggestFreeSlot(input.nextDate, nextDoseTime, tz);
        const endTime = addMinutesToTime(time, nextDoseDuration);
        await scheduleNextDoseAppointment({
          appliedId: input.appliedId,
          petId: input.petId,
          contactId: input.contactId,
          staffId: input.defaultStaffId,
          patientName: input.patientName,
          productName: input.productName,
          nextDate: input.nextDate,
          time,
          endTime,
          tz,
        });
        toast.success(
          'Turno agendado',
          `${input.patientName} · ${formatDate(input.nextDate)} ${time}–${endTime}`
        );
        await reload();
      } catch {
        toast.info('No se pudo agendar', 'La dosis quedó pendiente en Próximas dosis.');
      }
    },
    [nextDoseTime, nextDoseDuration, tz, reload]
  );

  const verTurno = useCallback((dateKey: string) => {
    views.open('appointments.agenda.open', { initialDate: dateKey });
  }, []);

  const scheduleDialogProps = {
    input: scheduleInput,
    onClose: closeSchedule,
    onScheduled: reload,
  };

  return { openSchedule, scheduleAuto, verTurno, scheduleDialogProps };
}
