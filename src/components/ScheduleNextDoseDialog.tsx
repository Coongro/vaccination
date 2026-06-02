import { getHostReact, getHostUI } from '@coongro/plugin-sdk';
import { DatePicker, TimePicker, useTenantTimezone } from '@coongro/calendar';
import { formatSpecies } from '@coongro/patients';

const UI = getHostUI();
import {
  scheduleNextDoseAppointment,
  suggestFreeSlot,
  addMinutesToTime,
} from '../data/useVaccinationData.js';
import { useVaccinationSettings } from '../data/useVaccinationSettings.js';
import { formatDate } from './lote-status.js';

const React = getHostReact();
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

const MODULE_ID = '@coongro/vaccination';

function toast(title: string, message: string, type: 'success' | 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | { show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

/** Lo que necesita el diálogo para agendar el turno de una próxima dosis. */
export interface ScheduleInput {
  appliedId: string;
  petId: string;
  contactId: string | null;
  patientName: string;
  productName: string;
  /** Fecha sugerida (la de la próxima dosis). Pre-carga la fecha del turno. */
  nextDate: string;
  /**
   * Profesional del turno. Ya lo conocemos (el de la última aplicación), así que
   * NO se pide en el diálogo — solo falta que el vet elija fecha y horario.
   */
  defaultStaffId: string | null;
  /** Tutor de la mascota — para el resumen del diálogo. */
  tutorName?: string;
  /** Especie de la mascota (código) — para el resumen del diálogo. */
  species?: string;
}

interface ScheduleNextDoseDialogProps {
  /** Si no es null, el diálogo está abierto para agendar ese turno. */
  input: ScheduleInput | null;
  onClose: () => void;
  /** Se llama tras agendar con éxito (para refrescar la vista). */
  onScheduled: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FieldGroup({ label, required, hint, children }: any) {
  return h(
    'div',
    { className: 'flex flex-col gap-1.5' },
    h(UI.Label, null, label, required && h('span', { className: 'text-cg-danger ml-0.5' }, '*')),
    children,
    hint && h('span', { className: 'text-xs text-cg-text-muted' }, hint)
  );
}

/**
 * Diálogo para agendar el turno de una próxima dosis. Fecha + hora de inicio + hora
 * de fin, todo pre-cargado (fecha = próxima dosis, inicio = primer hueco libre
 * sugerido, fin = inicio + duración del setting) y editable con los selectores de
 * Coongro. Lo usan el botón "Agendar" (worklist + detalle) y el modo "ask" del setting.
 */
export function ScheduleNextDoseDialog({ input, onClose, onScheduled }: ScheduleNextDoseDialogProps) {
  const tz = useTenantTimezone();
  const { nextDoseTime, nextDoseDuration } = useVaccinationSettings();

  const [fecha, setFecha] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Al abrir: pre-cargar fecha, sugerir el primer hueco libre como inicio y
  // calcular el fin = inicio + duración del setting.
  useEffect(() => {
    if (!input) return;
    setFecha(input.nextDate);
    setStartTime(nextDoseTime);
    setEndTime(addMinutesToTime(nextDoseTime, nextDoseDuration));
    let cancelled = false;
    void suggestFreeSlot(input.nextDate, nextDoseTime, tz).then((start) => {
      if (cancelled) return;
      setStartTime(start);
      setEndTime(addMinutesToTime(start, nextDoseDuration));
    });
    return () => {
      cancelled = true;
    };
  }, [input, nextDoseTime, nextDoseDuration, tz]);

  // Cambiar el inicio recalcula el fin (inicio + duración). El fin queda editable aparte.
  const handleStartChange = useCallback(
    (t: string) => {
      setStartTime(t);
      setEndTime(addMinutesToTime(t, nextDoseDuration));
    },
    [nextDoseDuration]
  );

  const invalidRange = !!startTime && !!endTime && endTime <= startTime;

  const handleConfirm = useCallback(async () => {
    if (!input || !fecha || !startTime || !endTime || invalidRange) return;
    if (!input.contactId) {
      toast('No se pudo agendar', 'La mascota no tiene un dueño asociado.', 'info');
      return;
    }
    setSaving(true);
    try {
      await scheduleNextDoseAppointment({
        appliedId: input.appliedId,
        petId: input.petId,
        contactId: input.contactId,
        staffId: input.defaultStaffId,
        patientName: input.patientName,
        productName: input.productName,
        nextDate: fecha,
        time: startTime,
        endTime,
        tz,
      });
      toast(
        'Turno agendado',
        `${input.patientName} · ${formatDate(fecha)} ${startTime}–${endTime}`,
        'success'
      );
      onScheduled();
      onClose();
    } catch {
      toast('No se pudo agendar', 'Revisá que la agenda esté disponible.', 'info');
    } finally {
      setSaving(false);
    }
  }, [input, fecha, startTime, endTime, invalidRange, tz, onScheduled, onClose]);

  return h(UI.FormDialogSubmit, {
    open: input !== null,
    onOpenChange: (val: boolean) => !val && onClose(),
    title: 'Agendar turno',
    eyebrow: 'PRÓXIMA DOSIS',
    subtitle: input ? `${input.patientName} · ${input.productName}` : '',
    size: 'md',
    submitLabel: saving ? 'Agendando…' : 'Agendar turno',
    onCancel: onClose,
    disabled: saving || !fecha || !startTime || !endTime || invalidRange,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: ({ formRef }: any) =>
      h(
        'form',
        {
          ref: formRef,
          onSubmit: (e: Event) => {
            e.preventDefault();
            void handleConfirm();
          },
          className: 'flex flex-col gap-4',
        },

        // Encabezado explicativo: qué es este turno.
        h(
          'p',
          { className: 'text-[13px] text-cg-text-muted leading-relaxed' },
          'Creás un turno en la agenda para aplicar la próxima dosis de vacunación. Es tentativo: coordiná día y hora con el tutor.'
        ),

        // Resumen de lo que se agenda: vacuna como título + paciente/especie/tutor debajo.
        input &&
          h(
            'div',
            { className: 'flex items-start gap-3 rounded-lg border border-cg-border px-3.5 py-3' },
            h(
              'div',
              {
                className:
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cg-brand/10',
              },
              h(UI.DynamicIcon, { icon: 'Syringe', size: 15, color: 'var(--cg-brand)' } as any)
            ),
            h(
              'div',
              { className: 'flex flex-col gap-0.5 min-w-0' },
              h('span', { className: 'text-[13px] font-semibold text-cg-text' }, input.productName),
              h(
                'span',
                { className: 'text-xs text-cg-text-muted' },
                [
                  input.patientName,
                  input.species ? formatSpecies(input.species) : null,
                  input.tutorName ? `Tutor: ${input.tutorName}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              )
            )
          ),

        h(
          UI.FormSection,
          { icon: 'CalendarPlus', title: 'Día y horario del turno' } as any,
          h(
            FieldGroup,
            { label: 'Fecha', required: true },
            h(DatePicker, {
              value: fecha,
              onChange: (v: string) => setFecha(v),
              placeholder: 'Fecha del turno',
            } as any)
          ),
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              { label: 'Hora inicio', required: true },
              h(TimePicker, { value: startTime, onChange: handleStartChange } as any)
            ),
            h(
              FieldGroup,
              {
                label: 'Hora fin',
                required: true,
                hint: invalidRange
                  ? 'El fin debe ser posterior al inicio.'
                  : `Sugerida: inicio + ${nextDoseDuration} min. Editable.`,
              },
              h(TimePicker, { value: endTime, onChange: (t: string) => setEndTime(t) } as any)
            )
          )
        )
      ),
  } as any);
}
