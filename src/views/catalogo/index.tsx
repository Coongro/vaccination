import {
  usePatientsSettings,
  SPECIES_LABELS,
  SPECIES_ICON,
  formatSpecies,
} from '@coongro/patients';
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

import { ProductDetailDrawer } from '../../components/ProductDetailDrawer.js';
import { VaccineFormDialog } from '../../components/VaccineFormDialog.js';
import {
  useVaccineCatalog,
  type VaccineCatalogItem,
  type CreateVaccineData,
} from '../../hooks/useVaccineCatalog.js';
import { VACCINE_TYPE_LABELS, ADMINISTRATION_ROUTE_LABELS } from '../../types/vaccination.js';
import type { VaccineType } from '../../types/vaccination.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect, useCallback, useMemo } = React;
const h = React.createElement;

// El host expone `window.coongro.toast.show({ title, message, type })` — NO tiene
// los helpers `.success/.info` (esos los agrega el wrapper del SDK vía usePlugin,
// que acá evitamos porque crashea en plugins de Verdaccio). Mapeamos a `.show`.
const MODULE_ID = '@coongro/vaccination';

function emitToast(title: string, message: string, type: 'success' | 'info' | 'error'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | {
        show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void;
      }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

const toast = {
  success: (title: string, message: string) => emitToast(title, message, 'success'),
  info: (title: string, message: string) => emitToast(title, message, 'info'),
  error: (title: string, message: string) => emitToast(title, message, 'error'),
};

type EstadoFilter = 'activos' | 'inactivos' | 'todos';

interface Lab {
  id: string;
  name: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// El catálogo (items + CRUD + tipos) vive en useVaccineCatalog; la vista solo
// aporta lo presentacional. `CatalogItem` es un alias local del tipo del hook
// para no renombrar en todo el archivo.
type CatalogItem = VaccineCatalogItem;

export function CatalogoView() {
  const { settings: patientsSettings } = usePatientsSettings();

  const availableSpecies = useMemo(
    () => Object.keys(SPECIES_LABELS).filter((sp) => patientsSettings.enabledSpecies[sp] !== false),
    [patientsSettings.enabledSpecies]
  );

  // Fuente única de los datos del catálogo (items + CRUD).
  const { items, loading, error, refetch, create, update, toggleActive } = useVaccineCatalog();

  const [labs, setLabs] = useState<Lab[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<CatalogItem | null>(null);
  const [detailVaccine, setDetailVaccine] = useState<CatalogItem | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('activos');
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [labFilter, setLabFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  // Laboratorios (maestro compartido) — presentacional: alimenta columnas y filtro.
  // Carga aparte de los items (que los trae el hook) porque vienen de otra fuente.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await actions.execute<Lab[]>('vademecum.laboratories.list');
        if (active) setLabs(Array.isArray(result) ? result : []);
      } catch {
        /* el catálogo igual se muestra; sin labs, las columnas caen a "—" */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const labMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lab of labs) map.set(lab.id, lab.name);
    return map;
  }, [labs]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (estadoFilter === 'activos') result = result.filter((v) => v.isActive);
    else if (estadoFilter === 'inactivos') result = result.filter((v) => !v.isActive);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) => v.name.toLowerCase().includes(q) || (v.notes ?? '').toLowerCase().includes(q)
      );
    }
    if (labFilter.length > 0) result = result.filter((v) => labFilter.includes(v.laboratoryId));
    if (selectedSpecies.length > 0)
      result = result.filter((v) => selectedSpecies.some((sp) => v.species.includes(sp)));
    if (selectedTypes.length > 0)
      result = result.filter((v) => selectedTypes.includes(v.vaccineType));

    if (sortKey && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const getValue = (v: CatalogItem): string | number => {
        switch (sortKey) {
          case 'name':
            return v.name.toLowerCase();
          case 'lab':
            return (labMap.get(v.laboratoryId) ?? '').toLowerCase();
          case 'cost':
            return v.purchaseCost ? Number(v.purchaseCost) : -1;
          case 'price':
            return v.suggestedPrice ? Number(v.suggestedPrice) : -1;
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
  }, [
    items,
    estadoFilter,
    search,
    labFilter,
    selectedSpecies,
    selectedTypes,
    sortKey,
    sortDir,
    labMap,
  ]);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    setSortKey(direction ? key : null);
    setSortDir(direction);
  }, []);

  // Los handlers delegan el CRUD en el hook y solo agregan el toast de éxito. En
  // error, NO atrapan acá: dejan propagar al handleSubmit del form, que muestra el
  // toast de error y mantiene el diálogo abierto.
  const handleCreate = useCallback(
    async (data: CreateVaccineData) => {
      await create(data);
      toast.success('Vacuna creada', `"${data.name}" agregada al catálogo`);
    },
    [create]
  );

  const handleUpdate = useCallback(
    async (data: CreateVaccineData) => {
      if (!editingVaccine) return;
      await update(editingVaccine.productId, editingVaccine.detailId, data);
      toast.success('Vacuna actualizada', `"${data.name}" guardada`);
    },
    [editingVaccine, update]
  );

  // El toggle se dispara desde el drawer (no del form), así que maneja su propio
  // error con un toast.
  const handleToggleActive = useCallback(
    async (item: CatalogItem) => {
      try {
        await toggleActive(item.productId, !item.isActive);
        toast.info(
          item.isActive ? 'Vacuna desactivada' : 'Vacuna activada',
          `"${item.name}" ${item.isActive ? 'desactivada' : 'activada'}`
        );
        if (detailVaccine?.productId === item.productId) setDetailVaccine(null);
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo cambiar el estado');
      }
    },
    [detailVaccine, toggleActive]
  );

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Producto',
        sortable: true,
        render: (item: CatalogItem) =>
          h(
            'div',
            null,
            h('div', { className: 'font-medium' }, item.name),
            h(
              'div',
              { className: 'text-xs text-cg-text-muted mt-0.5' },
              `Edad mín. ${item.minimumAgeMonths ? item.minimumAgeMonths + ' meses' : '—'} · ${ADMINISTRATION_ROUTE_LABELS[item.administrationRoute]}`
            )
          ),
      },
      {
        key: 'lab',
        header: 'Laboratorio',
        sortable: true,
        render: (item: CatalogItem) => labMap.get(item.laboratoryId) ?? '—',
      },
      {
        key: 'species',
        header: 'Especies',
        render: (item: CatalogItem) =>
          h(
            'div',
            { className: 'flex gap-1 flex-wrap' },
            ...item.species.map((sp) =>
              h(
                UI.Badge,
                { key: sp, variant: 'info', size: 'sm' } as any,
                h(UI.DynamicIcon, { icon: SPECIES_ICON[sp] ?? 'PawPrint', size: 11 } as any),
                h('span', { className: 'ml-1' }, formatSpecies(sp))
              )
            )
          ),
      },
      {
        key: 'schedule',
        header: 'Esquema',
        render: (item: CatalogItem) =>
          item.scheduleDoses
            ? `${item.scheduleDoses} dosis${item.scheduleIntervalDays ? ' · c/' + item.scheduleIntervalDays + 'd' : ''}`
            : '—',
      },
      {
        key: 'cost',
        header: 'Costo',
        className: 'text-right',
        sortable: true,
        render: (item: CatalogItem) =>
          item.purchaseCost
            ? h(
                'span',
                { className: 'font-mono text-cg-text-muted' },
                '$' + Number(item.purchaseCost).toLocaleString('es-AR')
              )
            : '—',
      },
      {
        key: 'price',
        header: 'Precio',
        className: 'text-right',
        sortable: true,
        render: (item: CatalogItem) =>
          item.suggestedPrice
            ? h(
                'span',
                { className: 'font-mono' },
                '$' + Number(item.suggestedPrice).toLocaleString('es-AR')
              )
            : '—',
      },
      {
        key: 'margin',
        header: 'Margen',
        className: 'text-right',
        render: (item: CatalogItem) => {
          const sale = Number(item.suggestedPrice);
          const cost = Number(item.purchaseCost);
          // Margen sobre venta. Necesita venta > 0 y un costo cargado (vacío/null/0 caen a "—").
          if (!item.purchaseCost || !(sale > 0))
            return h('span', { className: 'text-cg-text-muted' }, '—');
          const pct = ((sale - cost) / sale) * 100;
          return h(
            UI.Badge,
            { variant: pct > 0 ? 'success-soft' : 'danger-soft', size: 'sm' } as any,
            `${pct.toFixed(0)}%`
          );
        },
      },
    ],
    [labMap]
  );

  const filterRightSlot = h(
    'div',
    { className: 'flex gap-2 flex-wrap' },
    h(
      UI.MultiSelect,
      {
        values: labFilter,
        onValuesChange: (v: string[]) => setLabFilter(v),
        placeholder: 'Laboratorio',
        className: 'w-[200px]',
        renderChip: (val: string, onRemove: () => void) =>
          h(UI.Chip, { size: 'sm', onRemove } as any, labMap.get(val) ?? val),
      } as any,
      ...labs
        .filter((lab) => lab.is_active)
        .map((lab) => h(UI.SelectItem, { key: lab.id, value: lab.id } as any, lab.name))
    ),
    h(
      UI.MultiSelect,
      {
        values: selectedSpecies,
        onValuesChange: (v: string[]) => setSelectedSpecies(v),
        placeholder: 'Especie',
        className: 'w-[170px]',
      } as any,
      ...availableSpecies.map((sp) =>
        h(UI.SelectItem, { key: sp, value: sp } as any, formatSpecies(sp))
      )
    ),
    h(
      UI.MultiSelect,
      {
        values: selectedTypes,
        onValuesChange: (v: string[]) => setSelectedTypes(v),
        placeholder: 'Tipo',
        className: 'w-[150px]',
      } as any,
      ...(Object.entries(VACCINE_TYPE_LABELS) as [VaccineType, string][]).map(([val, label]) =>
        h(UI.SelectItem, { key: val, value: val } as any, label)
      )
    )
  );

  return h(
    'div',
    { className: 'font-inter min-h-screen bg-cg-bg-secondary p-6' },

    h(
      'div',
      { className: 'w-full flex flex-col gap-6' },

      // ── Header ──
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-cg-text' }, 'Vacunas'),
          h(
            'p',
            { className: 'text-sm text-cg-text-muted mt-1' },
            'Los productos vacunales que esta clínica tiene cargados para aplicar.'
          )
        ),
        h(
          'div',
          { className: 'flex gap-2 shrink-0' },
          h(
            UI.Button,
            {
              variant: 'brand',
              onClick: () => {
                setEditingVaccine(null);
                setShowForm(true);
              },
            } as any,
            h(UI.DynamicIcon, { icon: 'Plus', size: 14 } as any),
            ' Agregar vacuna'
          )
        )
      ),

      // ── DataTable en card ──
      h(
        'div',
        { className: 'bg-cg-bg rounded-xl border border-cg-border p-6 shadow-sm' },
        h(UI.DataTable, {
          data: filteredItems,
          rowKey: (item: CatalogItem) => item.productId,
          loading,
          error,
          onRetry: refetch,
          columns,
          searchPlaceholder: 'Buscar por nombre del producto',
          searchValue: search,
          onSearchChange: setSearch,
          sortKey,
          sortDirection: sortDir,
          onSortChange: handleSort,
          filterSections: [
            {
              label: 'Estado',
              options: [
                { value: 'activos', label: 'Activos' },
                { value: 'inactivos', label: 'Inactivos' },
                { value: 'todos', label: 'Todos' },
              ],
              value: estadoFilter,
              onChange: (v: string) => setEstadoFilter(v as EstadoFilter),
            },
          ],
          filterRightSlot,
          onRowClick: (item: CatalogItem) => setDetailVaccine(item),
          emptyState: {
            title: 'No hay vacunas activas en este momento',
            description:
              'Cambiá el filtro de Estado a Todos para ver los inactivos, o sumá una vacuna nueva.',
            icon: h(UI.DynamicIcon, { icon: 'Syringe', size: 32 } as any),
            action: h(
              'div',
              { style: { display: 'flex', gap: '8px' } },
              h(
                UI.Button,
                { variant: 'outline', onClick: () => setEstadoFilter('todos') } as any,
                'Ver todos'
              ),
              h(
                UI.Button,
                { variant: 'brand', onClick: () => setShowForm(true) } as any,
                '+ Agregar vacuna'
              )
            ),
            filteredTitle: 'No se encontraron vacunas con los filtros aplicados',
            filteredDescription: 'Probá cambiar los filtros o la búsqueda.',
          },
          skeletonRows: 8,
        } as any)
      ) // cierra card wrapper
    ), // cierra flex col

    // ── Drawers & Dialogs ──
    h(ProductDetailDrawer, {
      open: !!detailVaccine,
      onClose: () => setDetailVaccine(null),
      vaccine: detailVaccine,
      laboratoryName: detailVaccine ? (labMap.get(detailVaccine.laboratoryId) ?? '') : '',
      onEdit: () => {
        setEditingVaccine(detailVaccine);
        setDetailVaccine(null);
        setShowForm(true);
      },
      onToggleActive: () => {
        if (detailVaccine) void handleToggleActive(detailVaccine);
      },
    }),

    h(VaccineFormDialog, {
      open: showForm,
      onClose: () => {
        setShowForm(false);
        setEditingVaccine(null);
      },
      onSuccess: () => {
        setShowForm(false);
        setEditingVaccine(null);
      },
      availableSpecies,
      defaultSpecies: patientsSettings.defaultSpecies,
      vaccine: editingVaccine,
      onSubmit: editingVaccine ? handleUpdate : handleCreate,
    })
  );
}
