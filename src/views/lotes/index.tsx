import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

const UI = getHostUI();
import {
  computeBatchStatus,
  statusBadge,
  formatDate,
  daysUntil,
  isUsable,
} from '../../components/lote-status.js';
import type { BatchItem } from '../../components/lote-status.js';
import { LoteDetailDrawer } from '../../components/LoteDetailDrawer.js';
import { LoteFormDialog } from '../../components/LoteFormDialog.js';
import type { LoteFormData, LoteProductOption } from '../../components/LoteFormDialog.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

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

/** Tag en `variant.attributes.kind` que marca una variante como lote de vacunación. */
const BATCH_KIND = 'vaccination-batch';

type EstadoFilter = 'activos' | 'vencidos' | 'agotados' | 'bajas' | 'todos';

interface VaccineDetail {
  product_id: string;
  laboratory_id: string;
}

interface Product {
  id: string;
  name: string;
}

interface Lab {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  stock_current: string | null;
  is_active: boolean;
  attributes: Record<string, unknown> | null;
}

export function LotesView() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [products, setProducts] = useState<LoteProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingLote, setEditingLote] = useState<BatchItem | null>(null);
  const [detailLote, setDetailLote] = useState<BatchItem | null>(null);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('activos');
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [labFilter, setLabFilter] = useState<string[]>([]);
  const [porVencer, setPorVencer] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [details, productList, labs, variants] = await Promise.all([
        actions.execute<VaccineDetail[]>('vaccination.catalog.list'),
        actions.execute<Product[]>('products.items.list'),
        actions.execute<Lab[]>('vademecum.laboratories.list'),
        actions.execute<Variant[]>('products.variants.list'),
      ]);

      const labNameById = new Map<string, string>();
      for (const lab of labs) labNameById.set(lab.id, lab.name);

      const productNameById = new Map<string, string>();
      for (const p of productList) productNameById.set(p.id, p.name);

      // Solo los products que son vacunas (tienen vaccine_detail) y su laboratorio.
      const labByProductId = new Map<string, string>();
      for (const d of details)
        labByProductId.set(d.product_id, labNameById.get(d.laboratory_id) ?? '');

      const productOptions: LoteProductOption[] = [];
      for (const d of details) {
        const name = productNameById.get(d.product_id);
        if (!name) continue;
        productOptions.push({
          productId: d.product_id,
          name,
          labName: labByProductId.get(d.product_id) ?? '',
        });
      }
      productOptions.sort((a, b) => a.name.localeCompare(b.name));

      // Lotes = variantes marcadas como vaccination-batch cuyo product es una vacuna.
      const items: BatchItem[] = [];
      for (const v of variants) {
        const attrs = v.attributes ?? {};
        if (attrs.kind !== BATCH_KIND) continue;
        if (!labByProductId.has(v.product_id)) continue;
        const received = Number(attrs.received ?? 0);
        const remaining = Number(v.stock_current ?? 0);
        items.push({
          variantId: v.id,
          productId: v.product_id,
          productName: productNameById.get(v.product_id) ?? '—',
          labName: labByProductId.get(v.product_id) ?? '',
          lote: (attrs.lote as string) ?? v.sku ?? v.name,
          expiresAt: (attrs.expires_at as string) ?? '',
          received,
          remaining,
          applied: Math.max(0, received - remaining),
          notes: (attrs.notes as string) ?? null,
          isActive: v.is_active,
        });
      }

      setProducts(productOptions);
      setBatches(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar lotes');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const labOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const b of batches) if (b.labName) set.set(b.labName, b.labName);
    return Array.from(set.keys()).sort();
  }, [batches]);

  const filteredBatches = useMemo(() => {
    let result = batches;

    if (estadoFilter !== 'todos') {
      result = result.filter((b) => {
        const st = computeBatchStatus(b);
        if (estadoFilter === 'activos') return isUsable(st);
        if (estadoFilter === 'vencidos') return st === 'vencido';
        if (estadoFilter === 'agotados') return st === 'agotado';
        if (estadoFilter === 'bajas') return st === 'baja';
        return true;
      });
    }

    if (porVencer !== null) {
      result = result.filter((b) => {
        const days = daysUntil(b.expiresAt);
        return b.isActive && b.remaining > 0 && days !== null && days >= 0 && days <= porVencer;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b) => b.lote.toLowerCase().includes(q));
    }
    if (productFilter.length > 0)
      result = result.filter((b) => productFilter.includes(b.productId));
    if (labFilter.length > 0) result = result.filter((b) => labFilter.includes(b.labName));

    if (sortKey && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const getValue = (b: BatchItem): string | number => {
        switch (sortKey) {
          case 'lote':
            return b.lote.toLowerCase();
          case 'producto':
            return b.productName.toLowerCase();
          case 'lab':
            return b.labName.toLowerCase();
          case 'vencimiento':
            return b.expiresAt;
          case 'recibidas':
            return b.received;
          case 'aplicadas':
            return b.applied;
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
  }, [batches, estadoFilter, porVencer, search, productFilter, labFilter, sortKey, sortDir]);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    setSortKey(direction ? key : null);
    setSortDir(direction);
  }, []);

  const handleCreateLote = useCallback(
    async (data: LoteFormData) => {
      const variantId = uuid();
      // El lote se guarda como variante del product (reuso del inventario de products).
      await actions.execute('products.variants.create', {
        data: {
          id: variantId,
          product_id: data.productId,
          name: data.lote,
          sku: data.lote,
          stock_current: '0',
          attributes: {
            kind: BATCH_KIND,
            lote: data.lote,
            expires_at: data.expiresAt,
            received: data.received,
            notes: data.notes,
          },
          is_active: true,
        },
      });
      // Movimiento de stock 'in' → deja stock_current = recibidas y queda el histórico.
      // Aplicadas, más adelante, registrará un movimiento 'out' por cada dosis aplicada.
      await actions.execute('products.stock.create', {
        data: {
          id: uuid(),
          product_id: data.productId,
          variant_id: variantId,
          type: 'in',
          quantity: String(data.received),
          reference_type: 'vaccination_batch',
          notes: data.notes,
        },
      });
      toast.success('Lote cargado', `${data.lote} · ${data.received} dosis`);
      await loadData();
    },
    [loadData]
  );

  const handleUpdateLote = useCallback(
    async (data: LoteFormData) => {
      if (!editingLote) return;
      await actions.execute('products.variants.update', {
        id: editingLote.variantId,
        data: {
          name: data.lote,
          sku: data.lote,
          attributes: {
            kind: BATCH_KIND,
            lote: data.lote,
            expires_at: data.expiresAt,
            received: editingLote.received, // las recibidas no se editan (no descuadrar stock)
            notes: data.notes,
          },
        },
      });
      toast.success('Lote actualizado', data.lote);
      await loadData();
    },
    [editingLote, loadData]
  );

  const handleBaja = useCallback(
    async (variantId: string) => {
      const lote = batches.find((b) => b.variantId === variantId);
      await actions.execute('products.variants.update', {
        id: variantId,
        data: { is_active: false },
      });
      toast.info('Lote dado de baja', lote ? lote.lote : 'El lote fue retirado');
      await loadData();
    },
    [batches, loadData]
  );

  const columns = useMemo(
    () => [
      {
        key: 'lote',
        header: 'Nro. de lote',
        sortable: true,
        render: (b: BatchItem) => h('span', { className: 'font-mono font-semibold' }, b.lote),
      },
      {
        key: 'producto',
        header: 'Producto',
        sortable: true,
        render: (b: BatchItem) => b.productName,
      },
      {
        key: 'lab',
        header: 'Laboratorio',
        sortable: true,
        render: (b: BatchItem) => b.labName || '—',
      },
      {
        key: 'vencimiento',
        header: 'Vencimiento',
        sortable: true,
        render: (b: BatchItem) => h('span', { className: 'font-mono' }, formatDate(b.expiresAt)),
      },
      {
        key: 'estado',
        header: 'Estado',
        render: (b: BatchItem) => statusBadge(computeBatchStatus(b)),
      },
      {
        key: 'recibidas',
        header: 'Recibidas',
        className: 'text-right',
        sortable: true,
        render: (b: BatchItem) => h('span', { className: 'font-mono' }, String(b.received)),
      },
      {
        key: 'aplicadas',
        header: 'Aplicadas',
        className: 'text-right',
        sortable: true,
        render: (b: BatchItem) => h('span', { className: 'font-mono' }, String(b.applied)),
      },
    ],
    []
  );

  const filterRightSlot = h(
    'div',
    { className: 'flex gap-2 flex-wrap items-center' },
    h(
      UI.MultiSelect,
      {
        values: productFilter,
        onValuesChange: (v: string[]) => setProductFilter(v),
        placeholder: 'Producto',
        className: 'w-[200px]',
        renderChip: (val: string, onRemove: () => void) =>
          h(
            UI.Chip,
            { size: 'sm', onRemove } as any,
            products.find((p) => p.productId === val)?.name ?? val
          ),
      } as any,
      ...products.map((p) =>
        h(UI.SelectItem, { key: p.productId, value: p.productId } as any, p.name)
      )
    ),
    h(
      UI.MultiSelect,
      {
        values: labFilter,
        onValuesChange: (v: string[]) => setLabFilter(v),
        placeholder: 'Laboratorio',
        className: 'w-[180px]',
      } as any,
      ...labOptions.map((name) => h(UI.SelectItem, { key: name, value: name } as any, name))
    ),
    h(
      UI.Chip,
      {
        variant: porVencer === 30 ? 'brand' : 'default',
        onClick: () => setPorVencer(porVencer === 30 ? null : 30),
        className: 'cursor-pointer',
      } as any,
      'Vence en 30 días'
    ),
    h(
      UI.Chip,
      {
        variant: porVencer === 60 ? 'brand' : 'default',
        onClick: () => setPorVencer(porVencer === 60 ? null : 60),
        className: 'cursor-pointer',
      } as any,
      'Vence en 60 días'
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
          h('h1', { className: 'text-2xl font-bold text-cg-text' }, 'Lotes en stock'),
          h(
            'p',
            { className: 'text-sm text-cg-text-muted mt-1' },
            'Frascos físicos del consultorio. Lo que cargás acá es lo que podés aplicar.'
          )
        ),
        h(
          UI.Button,
          {
            variant: 'brand',
            onClick: () => {
              setEditingLote(null);
              setShowForm(true);
            },
          } as any,
          h(UI.DynamicIcon, { icon: 'Plus', size: 14 } as any),
          ' Cargar lote'
        )
      ),

      // Tabla
      h(
        'div',
        { className: 'bg-cg-bg rounded-xl border border-cg-border p-6 shadow-sm' },
        h(UI.DataTable, {
          data: filteredBatches,
          rowKey: (b: BatchItem) => b.variantId,
          loading,
          error,
          onRetry: loadData,
          columns,
          searchPlaceholder: 'Número de lote',
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
                { value: 'vencidos', label: 'Vencidos' },
                { value: 'agotados', label: 'Agotados' },
                { value: 'bajas', label: 'Dados de baja' },
                { value: 'todos', label: 'Todos' },
              ],
              value: estadoFilter,
              onChange: (v: string) => setEstadoFilter(v as EstadoFilter),
            },
          ],
          filterRightSlot,
          onRowClick: (b: BatchItem) => setDetailLote(b),
          emptyState: {
            title: 'No hay lotes cargados',
            description:
              'Cuando recibís un frasco nuevo, cargalo acá para poder aplicarlo y llevar el control de stock.',
            icon: h(UI.DynamicIcon, { icon: 'Box', size: 32 } as any),
            action: h(
              UI.Button,
              { variant: 'brand', onClick: () => setShowForm(true) } as any,
              '+ Cargar lote'
            ),
            filteredTitle: 'No se encontraron lotes con los filtros aplicados',
            filteredDescription: 'Probá cambiar los filtros o la búsqueda.',
          },
          skeletonRows: 8,
        } as any)
      )
    ),

    // Detalle
    h(LoteDetailDrawer, {
      open: !!detailLote,
      onClose: () => setDetailLote(null),
      lote: detailLote,
      onEdit: () => {
        setEditingLote(detailLote);
        setDetailLote(null);
        setShowForm(true);
      },
      onBaja: handleBaja,
    }),

    // Cargar / editar
    h(LoteFormDialog, {
      open: showForm,
      onClose: () => {
        setShowForm(false);
        setEditingLote(null);
      },
      onSuccess: () => {
        setShowForm(false);
        setEditingLote(null);
      },
      products,
      lote: editingLote
        ? {
            variantId: editingLote.variantId,
            productId: editingLote.productId,
            lote: editingLote.lote,
            expiresAt: editingLote.expiresAt,
            received: editingLote.received,
            notes: editingLote.notes,
          }
        : null,
      onSubmit: editingLote ? handleUpdateLote : handleCreateLote,
    })
  );
}
