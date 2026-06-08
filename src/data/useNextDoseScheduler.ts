import { useTenantTimezone } from '@coongro/calendar';
import { getHostReact, views } from '@coongro/plugin-sdk';

import { formatDate } from '../components/lote-status.js';
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

function toast(title: string, message: string, type: 'success' | 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | {
        show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void;
      }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

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
        toast(
          'Turno agendado',
          `${input.patientName} · ${formatDate(input.nextDate)} ${time}–${endTime}`,
          'success'
        );
        await reload();
      } catch {
        toast('No se pudo agendar', 'La dosis quedó pendiente en Próximas dosis.', 'info');
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
