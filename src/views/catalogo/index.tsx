import { usePatientsSettings, SPECIES_LABELS, formatSpecies } from '@coongro/patients';
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

const UI = getHostUI();
import { LaboratoryDrawer } from '../../components/LaboratoryDrawer.js';
import { ProductDetailDrawer } from '../../components/ProductDetailDrawer.js';
import { VaccineFormDialog } from '../../components/VaccineFormDialog.js';
import { VACCINE_TYPE_LABELS, ADMINISTRATION_ROUTE_LABELS } from '../../types/vaccination.js';
import type { VaccineType, AdministrationRoute } from '../../types/vaccination.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

// El host expone `window.coongro.toast.show({ title, message, type })` — NO tiene
// los helpers `.success/.info` (esos los agrega el wrapper del SDK vía usePlugin,
// que acá evitamos porque crashea en plugins de Verdaccio). Mapeamos a `.show`.
const MODULE_ID = '@coongro/vaccination';

function emitToast(title: string, message: string, type: 'success' | 'info'): void {
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
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type EstadoFilter = 'activos' | 'inactivos' | 'todos';

interface Lab {
  id: string;
  name: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VaccineDetail {
  id: string;
  product_id: string;
  laboratory_id: string;
  species: string[];
  vaccine_type: string;
  administration_route: string;
  minimum_age_months: number | null;
  schedule_doses: number | null;
  schedule_interval_days: number | null;
  notes: string | null;
}

interface Product {
  id: string;
  name: string;
  sale_price: string | null;
  is_active: boolean;
}

interface CatalogItem {
  productId: string;
  detailId: string;
  name: string;
  laboratoryId: string;
  species: string[];
  vaccineType: VaccineType;
  administrationRoute: AdministrationRoute;
  minimumAgeMonths: number | null;
  scheduleDoses: number | null;
  scheduleIntervalDays: number | null;
  suggestedPrice: string | null;
  isActive: boolean;
  notes: string | null;
}

interface CreateVaccineData {
  name: string;
  laboratoryId: string;
  species: string[];
  vaccineType: VaccineType;
  administrationRoute: AdministrationRoute;
  minimumAgeMonths?: number | null;
  scheduleDoses?: number | null;
  scheduleIntervalDays?: number | null;
  suggestedPrice?: string | null;
  notes?: string | null;
}

export function CatalogoView() {
  const { settings: patientsSettings } = usePatientsSettings();

  const availableSpecies = useMemo(
    () => Object.keys(SPECIES_LABELS).filter((sp) => patientsSettings.enabledSpecies[sp] !== false),
    [patientsSettings.enabledSpecies]
  );

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<CatalogItem | null>(null);
  const [detailVaccine, setDetailVaccine] = useState<CatalogItem | null>(null);
  const [showLabDrawer, setShowLabDrawer] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('activos');
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [labFilter, setLabFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [products, details, laboratories] = await Promise.all([
        actions.execute<Product[]>('products.items.list'),
        actions.execute<VaccineDetail[]>('vaccination.catalog.list'),
        actions.execute<Lab[]>('vaccination.laboratories.list'),
      ]);

      const detailByProductId = new Map<string, VaccineDetail>();
      for (const d of details) detailByProductId.set(d.product_id, d);

      const merged: CatalogItem[] = [];
      for (const p of products) {
        const d = detailByProductId.get(p.id);
        if (!d) continue;
        merged.push({
          productId: p.id,
          detailId: d.id,
          name: p.name,
          laboratoryId: d.laboratory_id,
          species: d.species ?? [],
          vaccineType: d.vaccine_type as VaccineType,
          administrationRoute: d.administration_route as AdministrationRoute,
          minimumAgeMonths: d.minimum_age_months,
          scheduleDoses: d.schedule_doses,
          scheduleIntervalDays: d.schedule_interval_days,
          suggestedPrice: p.sale_price,
          isActive: p.is_active,
          notes: d.notes,
        });
      }

      setItems(merged);
      setLabs(Array.isArray(laboratories) ? laboratories : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar catálogo');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const labMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lab of labs) map.set(lab.id, lab.name);
    return map;
  }, [labs]);

  // Productos del catálogo por laboratorio — alimenta el guard de borrado del drawer
  // (un laboratorio en uso no se puede eliminar, solo desactivar).
  const productCountByLab = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.laboratoryId] = (counts[item.laboratoryId] ?? 0) + 1;
    return counts;
  }, [items]);

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
          case 'vaccineType':
            return VACCINE_TYPE_LABELS[v.vaccineType] ?? '';
          case 'price':
            return v.suggestedPrice ? Number(v.suggestedPrice) : -1;
          case 'status':
            return v.isActive ? 1 : 0;
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

  const handleCreate = useCallback(
    async (data: CreateVaccineData) => {
      const productId = uuid();
      await actions.execute('products.items.create', {
        data: {
          id: productId,
          name: data.name,
          sale_price: data.suggestedPrice ?? null,
          tags: [data.vaccineType],
          metadata: { plugin: 'vaccination' },
        },
      });
      await actions.execute('vaccination.catalog.create', {
        data: {
          id: uuid(),
          product_id: productId,
          laboratory_id: data.laboratoryId,
          species: data.species,
          vaccine_type: data.vaccineType,
          administration_route: data.administrationRoute,
          minimum_age_months: data.minimumAgeMonths ?? null,
          schedule_doses: data.scheduleDoses ?? null,
          schedule_interval_days: data.scheduleIntervalDays ?? null,
          notes: data.notes ?? null,
        },
      });
      toast?.success('Vacuna creada', `"${data.name}" agregada al catálogo`);
      await loadData();
    },
    [loadData]
  );

  const handleUpdate = useCallback(
    async (data: CreateVaccineData) => {
      if (!editingVaccine) return;
      const productUpdate: Record<string, unknown> = {};
      const detailUpdate: Record<string, unknown> = {};
      productUpdate.name = data.name;
      productUpdate.sale_price = data.suggestedPrice ?? null;
      productUpdate.tags = [data.vaccineType];
      detailUpdate.laboratory_id = data.laboratoryId;
      detailUpdate.species = data.species;
      detailUpdate.vaccine_type = data.vaccineType;
      detailUpdate.administration_route = data.administrationRoute;
      detailUpdate.minimum_age_months = data.minimumAgeMonths ?? null;
      detailUpdate.schedule_doses = data.scheduleDoses ?? null;
      detailUpdate.schedule_interval_days = data.scheduleIntervalDays ?? null;
      detailUpdate.notes = data.notes ?? null;
      await Promise.all([
        actions.execute('products.items.update', {
          id: editingVaccine.productId,
          data: productUpdate,
        }),
        actions.execute('vaccination.catalog.update', {
          id: editingVaccine.detailId,
          data: detailUpdate,
        }),
      ]);
      toast?.success('Vacuna actualizada', `"${data.name}" guardada`);
      await loadData();
    },
    [editingVaccine, loadData]
  );

  const handleToggleActive = useCallback(
    async (item: CatalogItem) => {
      await actions.execute('products.items.update', {
        id: item.productId,
        data: { is_active: !item.isActive },
      });
      toast?.info(
        item.isActive ? 'Vacuna desactivada' : 'Vacuna activada',
        `"${item.name}" ${item.isActive ? 'desactivada' : 'activada'}`
      );
      if (detailVaccine?.productId === item.productId) setDetailVaccine(null);
      await loadData();
    },
    [detailVaccine, loadData]
  );

  const handleCreateLab = useCallback(
    async (data: { name: string }): Promise<Lab> => {
      const result = await actions.execute<Lab[]>('vaccination.laboratories.create', {
        data: { id: uuid(), ...data },
      });
      await loadData();
      return result[0];
    },
    [loadData]
  );

  const handleUpdateLab = useCallback(
    async (id: string, data: Partial<Lab>): Promise<Lab> => {
      const result = await actions.execute<Lab[]>('vaccination.laboratories.update', { id, data });
      await loadData();
      return result[0];
    },
    [loadData]
  );

  const handleRemoveLab = useCallback(
    async (id: string): Promise<void> => {
      const lab = labs.find((l) => l.id === id);
      await actions.execute('vaccination.laboratories.softDelete', { id });
      toast?.success(
        'Laboratorio eliminado',
        lab ? `"${lab.name}" eliminado` : 'Laboratorio eliminado'
      );
      await loadData();
    },
    [labs, loadData]
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
              h(UI.Badge, { key: sp, variant: 'secondary', size: 'sm' } as any, formatSpecies(sp))
            )
          ),
      },
      {
        key: 'vaccineType',
        header: 'Tipo',
        sortable: true,
        render: (item: CatalogItem) =>
          h(
            UI.Badge,
            {
              variant:
                item.vaccineType === 'rabies'
                  ? 'warning'
                  : item.vaccineType === 'core'
                    ? 'default'
                    : 'outline',
            } as any,
            VACCINE_TYPE_LABELS[item.vaccineType]
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
        key: 'status',
        header: 'Estado',
        className: 'text-right',
        sortable: true,
        render: (item: CatalogItem) =>
          h(
            UI.Badge,
            { variant: item.isActive ? 'success' : 'secondary' } as any,
            item.isActive ? 'Activo' : 'Inactivo'
          ),
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
          h('h1', { className: 'text-2xl font-bold text-cg-text' }, 'Catálogo'),
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
            { variant: 'outline', onClick: () => setShowLabDrawer(true) } as any,
            h(UI.DynamicIcon, { icon: 'Archive', size: 14 } as any),
            ' Gestionar laboratorios'
          ),
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
          onRetry: loadData,
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
      laboratories: labs,
      availableSpecies,
      defaultSpecies: patientsSettings.defaultSpecies,
      vaccine: editingVaccine,
      onSubmit: editingVaccine ? handleUpdate : handleCreate,
      onCreateLaboratory: async (name: string) => {
        const lab = await handleCreateLab({ name });
        toast?.success('Laboratorio creado', `"${name}" agregado`);
        return lab;
      },
    }),

    h(LaboratoryDrawer, {
      open: showLabDrawer,
      onClose: () => setShowLabDrawer(false),
      laboratories: labs,
      productCounts: productCountByLab,
      onCreate: handleCreateLab,
      onUpdate: handleUpdateLab,
      onRemove: handleRemoveLab,
    })
  );
}
