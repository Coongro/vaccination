import { getHostReact, getHostUI, views } from '@coongro/plugin-sdk';

const UI = getHostUI();
import type { AppliedItem, ScheduledNextDose } from '../data/useVaccinationData.js';

import { formatDate } from './lote-status.js';

const React = getHostReact();
const h = React.createElement;

interface AppliedDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  item: AppliedItem | null;
  /** Turno agendado para la próxima dosis de esta aplicación, si existe. */
  scheduled: ScheduledNextDose | undefined;
  /**
   * Si esta aplicación es la MÁS RECIENTE de su paciente+producto, es decir, la
   * que está vigente como próxima dosis (la misma que aparece en Próximas dosis).
   * Solo en ese caso ofrecemos "Agendar" — para una aplicación superada por otra
   * posterior, su próxima dosis ya no aplica.
   */
  isActiveRecall: boolean;
  /** Abre el diálogo para elegir fecha/hora y agendar el turno. */
  onAgendar: () => void;
  /** Ver el turno agendado en la agenda. */
  onVerTurno: () => void;
}

const mono = { fontFamily: 'var(--cg-font-mono, SF Mono, Menlo, monospace)' };

export function AppliedDetailDrawer(props: AppliedDetailDrawerProps) {
  const { open, onClose, item, scheduled, isActiveRecall, onAgendar, onVerTurno } = props;
  if (!item) return null;

  const muted = (v: string | null | undefined) =>
    v ? h('span', null, v) : h('span', { style: { color: 'var(--cg-text-muted)' } }, '—');

  // Acción de la próxima dosis. Misma lógica que Próximas dosis: "Agendar" solo si
  // esta aplicación es la vigente (la última de su paciente+producto). Si tiene
  // turno → "Ver turno". Si fue superada por una dosis posterior → sin acción.
  const nextDoseAction = scheduled
    ? h(
        UI.Button,
        { variant: 'ghost', size: 'sm', onClick: onVerTurno } as any,
        h(UI.DynamicIcon, { icon: 'CalendarCheck', size: 13 } as any),
        ' Ver turno'
      )
    : isActiveRecall
      ? h(
          UI.Button,
          { variant: 'outline', size: 'sm', onClick: onAgendar } as any,
          h(UI.DynamicIcon, { icon: 'CalendarPlus', size: 13 } as any),
          ' Agendar'
        )
      : h(
          'span',
          { style: { fontSize: '11.5px', color: 'var(--cg-text-muted)', fontStyle: 'italic' } },
          'Reemplazada por una dosis posterior'
        );

  const nextDoseValue = !item.nextDoseDate
    ? muted(null)
    : h(
        'div',
        {
          style: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' },
        },
        h('span', { style: mono }, formatDate(item.nextDoseDate)),
        nextDoseAction
      );

  const detailRows: [string, unknown][] = [
    ['Fecha', h('span', { style: mono }, formatDate(item.appliedDate))],
    ['Paciente', h('span', { style: { fontWeight: 600 } }, item.patientName)],
    ['Dueño', muted(item.tutor)],
    ['Producto', item.productName],
    ['Laboratorio', muted(item.labName || null)],
    ['Lote', h('span', { style: mono }, item.lote)],
    ['Peso', item.weightKg ? h('span', { style: mono }, `${item.weightKg} kg`) : muted(null)],
    ['Profesional', muted(item.vetName === '—' ? null : item.vetName)],
    [
      'Nro. de dosis',
      item.doseNumber !== null && item.doseNumber !== undefined
        ? h('span', { style: mono }, String(item.doseNumber))
        : muted(null),
    ],
    ['Próxima dosis', nextDoseValue],
  ];

  return h(
    UI.Sheet,
    { open, onOpenChange: (val: boolean) => !val && onClose(), side: 'right' } as any,
    h(
      UI.SheetContent,
      {
        style: { width: '480px', maxWidth: '92vw', display: 'flex', flexDirection: 'column' },
      } as any,

      // Header
      h(
        UI.SheetHeader,
        null,
        h(
          'div',
          { style: { flex: 1, minWidth: 0 } },
          h(
            'div',
            {
              style: {
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--cg-text-muted)',
                marginBottom: '4px',
              },
            },
            'DETALLE DE APLICACIÓN'
          ),
          h(UI.SheetTitle, null, item.productName),
          h(
            'p',
            { style: { fontSize: '12.5px', color: 'var(--cg-text-muted)', margin: '4px 0 0' } },
            `${item.patientName} · ${formatDate(item.appliedDate)}`
          )
        )
      ),

      // Body
      h(
        'div',
        { style: { flex: 1, overflow: 'auto', padding: '20px 24px' } },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', marginBottom: '20px' } },
          ...detailRows.map(([label, value], i) =>
            h(
              'div',
              {
                key: label,
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '11px 0',
                  borderBottom: i < detailRows.length - 1 ? '1px solid var(--cg-border)' : 'none',
                  fontSize: '13px',
                },
              },
              h('span', { style: { color: 'var(--cg-text-muted)', flexShrink: 0 } }, label),
              h('span', { style: { color: 'var(--cg-text)', textAlign: 'right' } }, value as never)
            )
          )
        ),

        // Notas (bloque destacado — info que no se ve en la tabla)
        h(
          'div',
          null,
          h(
            'div',
            {
              style: {
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--cg-text-muted)',
                marginBottom: '8px',
              },
            },
            'Notas'
          ),
          item.notes
            ? h(
                'p',
                {
                  style: {
                    fontSize: '13px',
                    color: 'var(--cg-text)',
                    lineHeight: 1.6,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  },
                },
                item.notes
              )
            : h(
                'p',
                { style: { fontSize: '13px', color: 'var(--cg-text-muted)', margin: 0 } },
                'Sin notas registradas para esta aplicación.'
              )
        )
      ),

      // Footer — Ver paciente + Cerrar
      h(
        'div',
        {
          style: {
            padding: '16px 24px',
            borderTop: '1px solid var(--cg-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          },
        },
        h(
          UI.Button,
          {
            variant: 'outline',
            onClick: () => views.open('patients.detail.open', { petId: item.patientId }),
          } as any,
          h(UI.DynamicIcon, { icon: 'ExternalLink', size: 13 } as any),
          ' Ver paciente'
        ),
        h('span', { style: { flex: 1 } }),
        h(UI.Button, { variant: 'brand', onClick: onClose } as any, 'Cerrar')
      )
    )
  );
}
