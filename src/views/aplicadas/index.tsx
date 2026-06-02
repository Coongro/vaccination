import { getHostReact, getHostUI } from '@coongro/plugin-sdk';
import { formatSpecies, SPECIES_LABELS } from '@coongro/patients';

const UI = getHostUI();
import { useVaccinationData } from '../../data/useVaccinationData.js';
import type { AppliedItem } from '../../data/useVaccinationData.js';
import { useNextDoseScheduler } from '../../data/useNextDoseScheduler.js';
import { AppliedDetailDrawer } from '../../components/AppliedDetailDrawer.js';
import { ScheduleNextDoseDialog } from '../../components/ScheduleNextDoseDialog.js';
import { formatDate } from '../../components/lote-status.js';

const React = getHostReact();
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const h = React.createElement;

const MODULE_ID = '@coongro/vaccination';

function emitToast(title: string, message: string, type: 'success' | 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | { show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** date-key (yyyy-mm-dd) de hace N días desde hoy. */
function daysAgoKey(days: number): string {
  const t = new Date();
  t.setDate(t.getDate() - days);
  return t.toISOString().slice(0, 10);
}

type RangeFilter = '7d' | '30d' | 'mes' | 'todos';

/** Props opcionales al abrir la vista vía views.open (ej. desde "Ver aplicaciones"). */
interface AplicadasViewProps {
  productId?: string;
  lote?: string;
}

export function AplicadasView(props: AplicadasViewProps = {}) {
  // El alta NO vive acá (diseño COONG-182: Aplicadas es solo lectura). El registro
  // de una aplicación se hace desde la ficha del paciente o desde la consulta.
  const { appliedItems: items, products, scheduledByApplied, loading, error, reload } =
    useVaccinationData();
  const { openSchedule, verTurno, scheduleDialogProps } = useNextDoseScheduler(reload);

  const [detailItem, setDetailItem] = useState<AppliedItem | null>(null);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<RangeFilter>('30d');
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [speciesFilter, setSpeciesFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  // Filtro inicial cuando se abre desde "Ver aplicaciones" (Catálogo/Lotes).
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (props.productId || props.lote) setRange('todos');
    if (props.productId) setProductFilter([props.productId]);
    if (props.lote) setSearch(props.lote);
  }, [props.productId, props.lote]);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) if (it.staffId) map.set(it.staffId, it.vetName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const speciesOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.species) set.add(it.species);
    return Array.from(set);
  }, [items]);

  // El filtro de Producto lista solo los productos que aparecen en las aplicaciones.
  const productFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) map.set(it.productId, it.productName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (range !== 'todos') {
      const cutoff =
        range === 'mes' ? todayKey().slice(0, 8) + '01' : daysAgoKey(range === '7d' ? 7 : 30);
      result = result.filter((it) => it.appliedDate >= cutoff);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (it) =>
          it.patientName.toLowerCase().includes(q) ||
          it.tutor.toLowerCase().includes(q) ||
          it.lote.toLowerCase().includes(q)
      );
    }
    if (productFilter.length > 0)
      result = result.filter((it) => productFilter.includes(it.productId));
    if (staffFilter.length > 0) result = result.filter((it) => staffFilter.includes(it.staffId));
    if (speciesFilter.length > 0) result = result.filter((it) => speciesFilter.includes(it.species));

    if (sortKey && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const getValue = (it: AppliedItem): string => {
        switch (sortKey) {
          case 'fecha':
            return it.appliedDate;
          case 'paciente':
            return it.patientName.toLowerCase();
          case 'producto':
            return it.productName.toLowerCase();
          case 'lote':
            return it.lote.toLowerCase();
          case 'profesional':
            return it.vetName.toLowerCase();
          case 'next':
            return it.nextDoseDate ?? '';
          default:
            return '';
        }
      };
      result = [...result].sort((a, b) => {
        const av = getValue(a);
        const bv = getValue(b);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    return result;
  }, [items, range, search, productFilter, staffFilter, speciesFilter, sortKey, sortDir]);

  const handleSort = (key: string, direction: 'asc' | 'desc' | null) => {
    setSortKey(direction ? key : null);
    setSortDir(direction);
  };

  const detailScheduled = detailItem ? scheduledByApplied.get(detailItem.id) : undefined;

  // ¿Es la aplicación más reciente de su paciente+producto? Solo entonces su próxima
  // dosis está vigente (igual que en Próximas dosis); si hay otra posterior, quedó superada.
  const detailIsActiveRecall = useMemo(() => {
    if (!detailItem) return false;
    return !items.some(
      (it) =>
        it.patientId === detailItem.patientId &&
        it.productId === detailItem.productId &&
        it.appliedDate > detailItem.appliedDate
    );
  }, [detailItem, items]);

  const handleDetailAgendar = useCallback(() => {
    if (!detailItem?.nextDoseDate) return;
    openSchedule({
      appliedId: detailItem.id,
      petId: detailItem.patientId,
      contactId: detailItem.ownerContactId,
      patientName: detailItem.patientName,
      productName: detailItem.productName,
      nextDate: detailItem.nextDoseDate,
      defaultStaffId: detailItem.staffId || null,
      tutorName: detailItem.tutor,
      species: detailItem.species,
    });
    setDetailItem(null); // cerramos el detalle para que quede solo el diálogo
  }, [detailItem, openSchedule]);

  const handleDetailVerTurno = useCallback(() => {
    if (!detailItem) return;
    verTurno(detailScheduled?.date ?? detailItem.nextDoseDate ?? '');
  }, [detailItem, detailScheduled, verTurno]);

  const exportCsv = () => {
    const headers = [
      'Fecha',
      'Paciente',
      'Especie',
      'Tutor',
      'Producto',
      'Lote',
      'Profesional',
      'Próxima dosis',
    ];
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    for (const it of filteredItems) {
      lines.push(
        [
          formatDate(it.appliedDate),
          it.patientName,
          it.species ? formatSpecies(it.species) : '',
          it.tutor,
          it.productName,
          it.lote,
          it.vetName,
          it.nextDoseDate ? formatDate(it.nextDoseDate) : '',
        ]
          .map(escape)
          .join(',')
      );
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aplicaciones_${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    emitToast('Exportado', `${filteredItems.length} aplicaciones a CSV`, 'info');
  };

  const columns = useMemo(
    () => [
      {
        key: 'fecha',
        header: 'Fecha',
        sortable: true,
        render: (it: AppliedItem) =>
          h('span', { className: 'font-mono' }, formatDate(it.appliedDate)),
      },
      {
        key: 'paciente',
        header: 'Paciente',
        sortable: true,
        render: (it: AppliedItem) =>
          h(
            'div',
            null,
            h('div', { className: 'font-medium' }, it.patientName),
            h(
              'div',
              { className: 'text-xs text-cg-text-muted mt-0.5' },
              `${it.species ? formatSpecies(it.species) : '—'} · ${it.tutor}`
            )
          ),
      },
      {
        key: 'producto',
        header: 'Producto',
        sortable: true,
        render: (it: AppliedItem) => it.productName,
      },
      {
        key: 'lote',
        header: 'Lote',
        sortable: true,
        render: (it: AppliedItem) => h('span', { className: 'font-mono text-sm' }, it.lote),
      },
      {
        key: 'profesional',
        header: 'Profesional',
        sortable: true,
        render: (it: AppliedItem) => it.vetName,
      },
      {
        key: 'next',
        header: 'Próx. dosis',
        sortable: true,
        render: (it: AppliedItem) =>
          it.nextDoseDate ? h('span', { className: 'font-mono' }, formatDate(it.nextDoseDate)) : '—',
      },
    ],
    []
  );

  const filterRightSlot = h(
    'div',
    { className: 'flex gap-2 flex-wrap' },
    h(
      UI.MultiSelect,
      {
        values: productFilter,
        onValuesChange: (v: string[]) => setProductFilter(v),
        placeholder: 'Producto',
        className: 'w-[190px]',
        renderChip: (val: string, onRemove: () => void) =>
          h(
            UI.Chip,
            { size: 'sm', onRemove } as any,
            productFilterOptions.find((p) => p.id === val)?.name ??
              products.find((p) => p.productId === val)?.name ??
              val
          ),
      } as any,
      ...productFilterOptions.map((p) =>
        h(UI.SelectItem, { key: p.id, value: p.id } as any, p.name)
      )
    ),
    h(
      UI.MultiSelect,
      {
        values: staffFilter,
        onValuesChange: (v: string[]) => setStaffFilter(v),
        placeholder: 'Profesional',
        className: 'w-[180px]',
        renderChip: (val: string, onRemove: () => void) =>
          h(
            UI.Chip,
            { size: 'sm', onRemove } as any,
            staffOptions.find((s) => s.id === val)?.name ?? val
          ),
      } as any,
      ...staffOptions.map((s) => h(UI.SelectItem, { key: s.id, value: s.id } as any, s.name))
    ),
    h(
      UI.MultiSelect,
      {
        values: speciesFilter,
        onValuesChange: (v: string[]) => setSpeciesFilter(v),
        placeholder: 'Especie',
        className: 'w-[150px]',
      } as any,
      ...speciesOptions.map((sp) =>
        h(UI.SelectItem, { key: sp, value: sp } as any, SPECIES_LABELS[sp] ? formatSpecies(sp) : sp)
      )
    )
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
        { className: 'flex items-center justify-between' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-cg-text' }, 'Aplicadas'),
          h(
            'p',
            { className: 'text-sm text-cg-text-muted mt-1' },
            'Histórico cross-paciente. Filtrá para ver dosis de un lote, paciente o profesional puntual.'
          )
        ),
        h(
          UI.Button,
          { variant: 'outline', onClick: exportCsv, disabled: filteredItems.length === 0 } as any,
          h(UI.DynamicIcon, { icon: 'Download', size: 14 } as any),
          ' Exportar CSV'
        )
      ),

      // Tabla
      h(
        'div',
        { className: 'bg-cg-bg rounded-xl border border-cg-border p-6 shadow-sm' },
        h(UI.DataTable, {
          data: filteredItems,
          rowKey: (it: AppliedItem) => it.id,
          loading,
          error,
          onRetry: reload,
          onRowClick: (it: AppliedItem) => setDetailItem(it),
          columns,
          searchPlaceholder: 'Paciente, dueño o lote',
          searchValue: search,
          onSearchChange: setSearch,
          sortKey,
          sortDirection: sortDir,
          onSortChange: handleSort,
          filterSections: [
            {
              label: 'Rango',
              options: [
                { value: '7d', label: 'Últimos 7 días' },
                { value: '30d', label: 'Últimos 30 días' },
                { value: 'mes', label: 'Este mes' },
                { value: 'todos', label: 'Todos' },
              ],
              value: range,
              onChange: (v: string) => setRange(v as RangeFilter),
            },
          ],
          filterRightSlot,
          emptyState: {
            title: 'No hay aplicaciones en este rango',
            description:
              'Las vacunas aplicadas se registran desde la ficha del paciente o la consulta, y aparecen acá.',
            icon: h(UI.DynamicIcon, { icon: 'Syringe', size: 32 } as any),
            filteredTitle: 'No se encontraron aplicaciones con los filtros aplicados',
            filteredDescription: 'Probá cambiar los filtros o la búsqueda.',
          },
          skeletonRows: 8,
        } as any)
      )
    ),

    // Detalle de la aplicación (drawer)
    h(AppliedDetailDrawer, {
      open: detailItem !== null,
      onClose: () => setDetailItem(null),
      item: detailItem,
      scheduled: detailScheduled,
      isActiveRecall: detailIsActiveRecall,
      onAgendar: handleDetailAgendar,
      onVerTurno: handleDetailVerTurno,
    }),

    // Diálogo para elegir fecha/hora del turno
    h(ScheduleNextDoseDialog, scheduleDialogProps)
  );
}
