import { getHostReact, getHostUI } from '@coongro/plugin-sdk';
import { formatSpecies } from '@coongro/patients';

const UI = getHostUI();
import { useVaccinationData } from '../../data/useVaccinationData.js';
import { useNextDoseScheduler } from '../../data/useNextDoseScheduler.js';
import { NextDoseDetailDrawer } from '../../components/NextDoseDetailDrawer.js';
import { ScheduleNextDoseDialog } from '../../components/ScheduleNextDoseDialog.js';
import { formatDate, daysUntil } from '../../components/lote-status.js';

const React = getHostReact();
const { useState, useMemo, useCallback } = React;
const h = React.createElement;

type RangeFilter = 'sem' | '2sem' | 'mes' | 'venc' | 'todas';
type StatusFilter = 'por-agendar' | 'agendadas' | 'todas';

export interface UpcomingRow {
  id: string;
  patientId: string;
  patientName: string;
  species: string;
  tutor: string;
  ownerContactId: string | null;
  staffId: string;
  productName: string;
  nextDate: string;
  days: number;
  status: 'pendiente' | 'vencida' | 'agendada';
  /** Si está agendada: date-key del turno para deep-link a la agenda. */
  scheduledDate: string | null;
}

function whenLabel(days: number): string {
  if (days < 0) return `Venció hace ${-days} día${-days === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

export function ProximasDosisView() {
  const { appliedItems, scheduledByApplied, loading, error, reload } = useVaccinationData();
  const { openSchedule, verTurno, scheduleDialogProps } = useNextDoseScheduler(reload);
  const [detailRow, setDetailRow] = useState<UpcomingRow | null>(null);
  const [range, setRange] = useState<RangeFilter>('todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('por-agendar');
  const [search, setSearch] = useState('');

  // Una "próxima dosis" por paciente+producto: la de la última aplicación
  // (las dosis anteriores quedan superadas por la más reciente).
  const upcoming = useMemo(() => {
    const latestByKey = new Map<string, (typeof appliedItems)[number]>();
    for (const a of appliedItems) {
      if (!a.nextDoseDate) continue;
      const key = `${a.patientId}|${a.productId}`;
      const prev = latestByKey.get(key);
      if (!prev || a.appliedDate > prev.appliedDate) latestByKey.set(key, a);
    }
    const rows: UpcomingRow[] = [];
    for (const a of latestByKey.values()) {
      const days = daysUntil(a.nextDoseDate as string) ?? 0;
      const scheduled = scheduledByApplied.get(a.id);
      rows.push({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patientName,
        species: a.species,
        tutor: a.tutor,
        ownerContactId: a.ownerContactId,
        staffId: a.staffId,
        productName: a.productName,
        nextDate: a.nextDoseDate as string,
        days,
        status: scheduled ? 'agendada' : days < 0 ? 'vencida' : 'pendiente',
        scheduledDate: scheduled?.date ?? null,
      });
    }
    rows.sort((x, y) => (x.nextDate < y.nextDate ? -1 : 1));
    return rows;
  }, [appliedItems, scheduledByApplied]);

  // Agendar → abre el diálogo (fecha + hora inicio/fin) para esa dosis.
  const handleAgendar = useCallback(
    (row: UpcomingRow) =>
      openSchedule({
        appliedId: row.id,
        petId: row.patientId,
        contactId: row.ownerContactId,
        patientName: row.patientName,
        productName: row.productName,
        nextDate: row.nextDate,
        defaultStaffId: row.staffId || null,
        tutorName: row.tutor,
        species: row.species,
      }),
    [openSchedule]
  );

  const handleVerTurno = useCallback(
    (row: UpcomingRow) => verTurno(row.scheduledDate ?? row.nextDate),
    [verTurno]
  );

  const overdueCount = useMemo(
    () => upcoming.filter((u) => u.status === 'vencida').length,
    [upcoming]
  );

  // Detalle (ficha de recall): la aplicación que disparó + otras dosis del paciente.
  const detailTrigger = detailRow ? appliedItems.find((a) => a.id === detailRow.id) : undefined;
  const detailOtherDoses = useMemo(
    () =>
      detailRow
        ? upcoming.filter((u) => u.patientId === detailRow.patientId && u.id !== detailRow.id)
        : [],
    [detailRow, upcoming]
  );

  const handleDetailAgendar = useCallback(() => {
    if (!detailRow) return;
    handleAgendar(detailRow); // abre el diálogo de fecha/hora
    setDetailRow(null); // cerramos la ficha de recall para que quede solo el diálogo
  }, [detailRow, handleAgendar]);

  const handleDetailVerTurno = useCallback(() => {
    if (detailRow) handleVerTurno(detailRow);
  }, [detailRow, handleVerTurno]);

  const filteredRows = useMemo(() => {
    let result = upcoming;
    // Estado: por defecto la worklist muestra solo lo accionable (sin agendar).
    if (statusFilter === 'por-agendar') result = result.filter((u) => u.status !== 'agendada');
    else if (statusFilter === 'agendadas') result = result.filter((u) => u.status === 'agendada');
    if (range === 'venc') result = result.filter((u) => u.status === 'vencida');
    else if (range !== 'todas') {
      const max = range === 'sem' ? 7 : range === '2sem' ? 14 : 30;
      result = result.filter((u) => u.days >= 0 && u.days <= max);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) => u.patientName.toLowerCase().includes(q) || u.tutor.toLowerCase().includes(q)
      );
    }
    return result;
  }, [upcoming, range, statusFilter, search]);

  const columns = useMemo(
    () => [
      {
        key: 'proxima',
        header: 'Próxima dosis',
        render: (u: UpcomingRow) => h('span', { className: 'font-mono' }, formatDate(u.nextDate)),
      },
      {
        key: 'cuando',
        header: 'Cuándo',
        render: (u: UpcomingRow) =>
          h(
            UI.Badge,
            {
              variant: u.status === 'vencida' ? 'danger' : u.days <= 3 ? 'warning' : 'secondary',
            } as any,
            whenLabel(u.days)
          ),
      },
      {
        key: 'paciente',
        header: 'Paciente',
        render: (u: UpcomingRow) =>
          h(
            'div',
            null,
            h('div', { className: 'font-medium' }, u.patientName),
            h(
              'div',
              { className: 'text-xs text-cg-text-muted mt-0.5' },
              `${u.species ? formatSpecies(u.species) : '—'} · ${u.tutor}`
            )
          ),
      },
      { key: 'producto', header: 'Producto', render: (u: UpcomingRow) => u.productName },
      {
        key: 'estado',
        header: 'Estado',
        render: (u: UpcomingRow) =>
          h(
            UI.Badge,
            {
              variant:
                u.status === 'vencida' ? 'danger' : u.status === 'agendada' ? 'success' : 'secondary',
            } as any,
            u.status === 'vencida' ? 'Vencida' : u.status === 'agendada' ? 'Agendada' : 'Pendiente'
          ),
      },
      {
        key: 'acciones',
        header: 'Acciones',
        className: 'text-right',
        render: (u: UpcomingRow) =>
          h(
            'div',
            { className: 'flex items-center justify-end' },
            u.status === 'agendada'
              ? h(
                  UI.Button,
                  {
                    variant: 'ghost',
                    size: 'sm',
                    onClick: (e: Event) => {
                      e.stopPropagation();
                      handleVerTurno(u);
                    },
                  } as any,
                  h(UI.DynamicIcon, { icon: 'CalendarCheck', size: 13 } as any),
                  ' Ver turno'
                )
              : h(
                  UI.Button,
                  {
                    variant: 'outline',
                    size: 'sm',
                    onClick: (e: Event) => {
                      e.stopPropagation();
                      handleAgendar(u);
                    },
                  } as any,
                  h(UI.DynamicIcon, { icon: 'CalendarPlus', size: 13 } as any),
                  ' Agendar'
                )
          ),
      },
    ],
    [handleAgendar, handleVerTurno]
  );

  return h(
    'div',
    { className: 'font-inter min-h-screen bg-cg-bg-secondary p-6' },

    h(
      'div',
      { className: 'w-full flex flex-col gap-6' },

      // Header
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-cg-text' }, 'Próximas dosis'),
        h(
          'p',
          { className: 'text-sm text-cg-text-muted mt-1' },
          'La agenda forward — quién toca cuándo y a quién hay que llamar.'
        )
      ),

      // Hero de vencidas
      overdueCount > 0 &&
        h(
          'div',
          {
            className:
              'flex items-center gap-3 rounded-xl border border-cg-danger-border bg-cg-danger-bg px-5 py-4',
          },
          h(UI.DynamicIcon, { icon: 'TriangleAlert', size: 20, color: 'var(--cg-danger)' } as any),
          h(
            'div',
            { className: 'flex-1' },
            h(
              'div',
              { className: 'font-bold text-cg-danger' },
              `${overdueCount} ${overdueCount === 1 ? 'dosis vencida' : 'dosis vencidas'}`
            ),
            h(
              'div',
              { className: 'text-sm text-cg-danger/90 mt-0.5' },
              'Contactá a los tutores antes de que se atrasen más.'
            )
          ),
          h(
            UI.Button,
            { variant: 'outline', size: 'sm', onClick: () => setRange('venc') } as any,
            'Ver vencidas'
          )
        ),

      // Tabla
      h(
        'div',
        { className: 'bg-cg-bg rounded-xl border border-cg-border p-6 shadow-sm' },
        h(UI.DataTable, {
          data: filteredRows,
          rowKey: (u: UpcomingRow) => u.id,
          loading,
          error,
          onRetry: reload,
          onRowClick: (u: UpcomingRow) => setDetailRow(u),
          columns,
          searchPlaceholder: 'Paciente o tutor',
          searchValue: search,
          onSearchChange: setSearch,
          filterSections: [
            {
              label: 'Estado',
              options: [
                { value: 'por-agendar', label: 'Por agendar' },
                { value: 'agendadas', label: 'Agendadas' },
                { value: 'todas', label: 'Todas' },
              ],
              value: statusFilter,
              onChange: (v: string) => setStatusFilter(v as StatusFilter),
            },
            {
              label: 'Rango',
              options: [
                { value: 'sem', label: 'Esta semana' },
                { value: '2sem', label: '2 semanas' },
                { value: 'mes', label: 'Este mes' },
                { value: 'venc', label: 'Vencidas' },
                { value: 'todas', label: 'Todas' },
              ],
              value: range,
              onChange: (v: string) => setRange(v as RangeFilter),
            },
          ],
          emptyState: {
            title: 'No hay próximas dosis en este rango',
            description:
              'Las próximas dosis se calculan del esquema del catálogo al registrar una aplicación.',
            icon: h(UI.DynamicIcon, { icon: 'CalendarClock', size: 32 } as any),
            filteredTitle: 'No se encontraron próximas dosis con los filtros aplicados',
            filteredDescription: 'Probá cambiar el rango o la búsqueda.',
          },
          skeletonRows: 6,
        } as any)
      )
    ),

    // Ficha de recall (drawer)
    h(NextDoseDetailDrawer, {
      open: detailRow !== null,
      onClose: () => setDetailRow(null),
      row: detailRow,
      trigger: detailTrigger,
      otherDoses: detailOtherDoses,
      onAgendar: handleDetailAgendar,
      onVerTurno: handleDetailVerTurno,
    }),

    // Diálogo para elegir fecha/hora del turno
    h(ScheduleNextDoseDialog, scheduleDialogProps)
  );
}
