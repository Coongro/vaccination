import { formatSpecies } from '@coongro/patients';
import { getHostReact, getHostUI, views } from '@coongro/plugin-sdk';

const UI = getHostUI();
import type { AppliedItem } from '../data/useVaccinationData.js';
import type { UpcomingRow } from '../views/proximas-dosis/index.js';

import { formatDate } from './lote-status.js';

const React = getHostReact();
const h = React.createElement;

const MODULE_ID = '@coongro/vaccination';

function toast(title: string, message: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | {
        show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void;
      }
    | undefined;
  host?.show?.({ title, message, type: 'info', moduleId: MODULE_ID });
}

/** Copia un valor al portapapeles y avisa. Funciona en cualquier dispositivo (a
 * diferencia de tel:/mailto, que en desktop no hacen nada confiable). */
function copyToClipboard(value: string, label: string): void {
  void navigator.clipboard?.writeText(value).then(
    () => toast('Copiado', `${label} copiado al portapapeles.`),
    () => toast('No se pudo copiar', 'Copialo manualmente.')
  );
}

interface NextDoseDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Dosis enfocada (la fila clickeada). */
  row: UpcomingRow | null;
  /** Aplicación que disparó este recall (para lote, profesional, contacto del tutor). */
  trigger: AppliedItem | undefined;
  /** Otras próximas dosis del mismo paciente (sin contar la enfocada). */
  otherDoses: UpcomingRow[];
  /** Abre el diálogo para elegir fecha/hora del turno. */
  onAgendar: () => void;
  onVerTurno: () => void;
}

const mono = { fontFamily: 'var(--cg-font-mono, SF Mono, Menlo, monospace)' };

function statusBadge(status: UpcomingRow['status']) {
  const variant = status === 'vencida' ? 'danger' : status === 'agendada' ? 'success' : 'secondary';
  const label = status === 'vencida' ? 'Vencida' : status === 'agendada' ? 'Agendada' : 'Pendiente';
  return h(UI.Badge, { variant } as any, label);
}

function whenLabel(days: number): string {
  if (days < 0) return `Venció hace ${-days} día${-days === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

export function NextDoseDetailDrawer(props: NextDoseDetailDrawerProps) {
  const { open, onClose, row, trigger, otherDoses, onAgendar, onVerTurno } = props;
  if (!row) return null;

  const muted = (v: string | null | undefined) =>
    v ? h('span', null, v) : h('span', { style: { color: 'var(--cg-text-muted)' } }, '—');

  const sectionTitle = (label: string) =>
    h(
      'div',
      {
        style: {
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cg-text-muted)',
          margin: '4px 0 8px',
        },
      },
      label
    );

  // Valor de contacto = texto + botón "Copiar". Copiar funciona en todo dispositivo
  // (a diferencia de tel:/mailto, que en desktop no llaman/abren de forma confiable).
  const copyField = (value: string, label: string, monoText: boolean) =>
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' } },
      h('span', monoText ? { style: mono } : null, value),
      h(
        UI.IconButton,
        {
          variant: 'ghost',
          size: 'sm',
          'aria-label': `Copiar ${label.toLowerCase()}`,
          onClick: () => copyToClipboard(value, label),
        } as any,
        h(UI.DynamicIcon, { icon: 'Copy', size: 13 } as any)
      )
    );

  const contactRows: [string, unknown][] = [
    ['Dueño', h('span', { style: { fontWeight: 600 } }, row.tutor)],
    [
      'Teléfono',
      trigger?.tutorPhone ? copyField(trigger.tutorPhone, 'Teléfono', true) : muted(null),
    ],
    ['Email', trigger?.tutorEmail ? copyField(trigger.tutorEmail, 'Email', false) : muted(null)],
  ];

  const triggerRows: [string, unknown][] = [
    ['Producto', row.productName],
    ['Lote', trigger ? h('span', { style: mono }, trigger.lote) : muted(null)],
    [
      'Aplicada',
      trigger ? h('span', { style: mono }, formatDate(trigger.appliedDate)) : muted(null),
    ],
    ['Profesional', muted(trigger && trigger.vetName !== '—' ? trigger.vetName : null)],
  ];

  const renderRows = (rows: [string, unknown][]) =>
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', marginBottom: '20px' } },
      ...rows.map(([label, value], i) =>
        h(
          'div',
          {
            key: label,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              padding: '10px 0',
              borderBottom: i < rows.length - 1 ? '1px solid var(--cg-border)' : 'none',
              fontSize: '13px',
            },
          },
          h('span', { style: { color: 'var(--cg-text-muted)', flexShrink: 0 } }, label),
          h('span', { style: { color: 'var(--cg-text)', textAlign: 'right' } }, value as never)
        )
      )
    );

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
            'RECALL · PRÓXIMA DOSIS'
          ),
          h(UI.SheetTitle, null, row.patientName),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 0' } },
            statusBadge(row.status),
            h(
              'span',
              { style: { fontSize: '12.5px', color: 'var(--cg-text-muted)' } },
              `${row.species ? formatSpecies(row.species) : '—'} · ${whenLabel(row.days)} (${formatDate(row.nextDate)})`
            )
          )
        )
      ),

      // Body
      h(
        'div',
        { style: { flex: 1, overflow: 'auto', padding: '20px 24px' } },

        sectionTitle('Contacto del dueño'),
        renderRows(contactRows),

        sectionTitle('Última aplicación'),
        renderRows(triggerRows),

        // Otras próximas dosis del mismo paciente (vista consolidada de recall)
        otherDoses.length > 0 &&
          h(
            'div',
            null,
            sectionTitle('Otras próximas dosis de este paciente'),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '8px',
                },
              },
              ...otherDoses.map((d) =>
                h(
                  'div',
                  {
                    key: d.id,
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 10px',
                      border: '1px solid var(--cg-border)',
                      borderRadius: '8px',
                      fontSize: '13px',
                    },
                  },
                  h('span', null, d.productName),
                  h(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    h(
                      'span',
                      { style: { ...mono, color: 'var(--cg-text-muted)' } },
                      formatDate(d.nextDate)
                    ),
                    statusBadge(d.status)
                  )
                )
              )
            )
          )
      ),

      // Footer — Ver paciente + acción de turno + Cerrar
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
            onClick: () =>
              row.patientId && views.open('patients.detail.open', { petId: row.patientId }),
          } as any,
          h(UI.DynamicIcon, { icon: 'ExternalLink', size: 13 } as any),
          ' Ver paciente'
        ),
        h('span', { style: { flex: 1 } }),
        h(UI.Button, { variant: 'outline', onClick: onClose } as any, 'Cerrar'),
        row.status === 'agendada'
          ? h(
              UI.Button,
              { variant: 'brand', onClick: onVerTurno } as any,
              h(UI.DynamicIcon, { icon: 'CalendarCheck', size: 13 } as any),
              ' Ver turno'
            )
          : h(
              UI.Button,
              { variant: 'brand', onClick: onAgendar } as any,
              h(UI.DynamicIcon, { icon: 'CalendarPlus', size: 13 } as any),
              ' Agendar'
            )
      )
    )
  );
}
