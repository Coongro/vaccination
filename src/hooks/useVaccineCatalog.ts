import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { VaccineDetailRow } from '../schema/vaccine-detail.js';
import type { VaccineType, AdministrationRoute } from '../types/vaccination.js';

const { useState, useEffect, useCallback, useRef, useMemo } = getHostReact();

interface ProductRow {
  id: string;
  name: string;
  sale_price: string | null;
  purchase_price: string | null;
  is_active: boolean;
  category_id: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
}

export interface VaccineCatalogItem {
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
  /** Costo de compra del producto (promedio ponderado, autorellenado al comprar — COONG-223). */
  purchaseCost: string | null;
  isActive: boolean;
  notes: string | null;
}

export interface CatalogFilters {
  search: string;
  laboratoryId: string | null;
  vaccineType: VaccineType | null;
  species: string | null;
  isActive: boolean | null;
}

export interface UseVaccineCatalogResult {
  items: VaccineCatalogItem[];
  filtered: VaccineCatalogItem[];
  loading: boolean;
  error: string | null;
  filters: CatalogFilters;
  setFilters: (filters: Partial<CatalogFilters>) => void;
  refetch: () => Promise<void>;
  create: (data: CreateVaccineData) => Promise<void>;
  update: (productId: string, detailId: string, data: UpdateVaccineData) => Promise<void>;
  toggleActive: (productId: string, isActive: boolean) => Promise<void>;
}

export interface CreateVaccineData {
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

export interface UpdateVaccineData extends Partial<CreateVaccineData> {}

const DEFAULT_FILTERS: CatalogFilters = {
  search: '',
  laboratoryId: null,
  vaccineType: null,
  species: null,
  isActive: null,
};

export function useVaccineCatalog(): UseVaccineCatalogResult {
  const [items, setItems] = useState<VaccineCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [products, details] = await Promise.all([
        actions.execute<ProductRow[]>('products.items.list'),
        actions.execute<VaccineDetailRow[]>('vaccination.catalog.list'),
      ]);

      const detailByProductId = new Map<string, VaccineDetailRow>();
      for (const d of details) {
        detailByProductId.set(d.product_id, d);
      }

      const merged: VaccineCatalogItem[] = [];
      for (const product of products) {
        const detail = detailByProductId.get(product.id);
        if (!detail) continue;

        merged.push({
          productId: product.id,
          detailId: detail.id,
          name: product.name,
          laboratoryId: detail.laboratory_id,
          species: (detail.species as string[]) ?? [],
          vaccineType: detail.vaccine_type as VaccineType,
          administrationRoute: detail.administration_route as AdministrationRoute,
          minimumAgeMonths: detail.minimum_age_months,
          scheduleDoses: detail.schedule_doses,
          scheduleIntervalDays: detail.schedule_interval_days,
          suggestedPrice: product.sale_price,
          purchaseCost: product.purchase_price,
          isActive: product.is_active,
          notes: detail.notes,
        });
      }

      if (mountedRef.current) setItems(merged);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Error al cargar catálogo');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setFilters = useCallback((partial: Partial<CatalogFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const filtered = useMemo(() => {
    let result = items;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (v) => v.name.toLowerCase().includes(q) || (v.notes ?? '').toLowerCase().includes(q)
      );
    }

    if (filters.laboratoryId) {
      result = result.filter((v) => v.laboratoryId === filters.laboratoryId);
    }

    if (filters.vaccineType) {
      result = result.filter((v) => v.vaccineType === filters.vaccineType);
    }

    if (filters.species) {
      result = result.filter((v) => v.species.includes(filters.species));
    }

    if (filters.isActive !== null) {
      result = result.filter((v) => v.isActive === filters.isActive);
    }

    return result;
  }, [items, filters]);

  const create = useCallback(
    async (data: CreateVaccineData): Promise<void> => {
      const productId = crypto.randomUUID();

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
          id: crypto.randomUUID(),
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

      await refetch();
    },
    [refetch]
  );

  const update = useCallback(
    async (productId: string, detailId: string, data: UpdateVaccineData): Promise<void> => {
      const productUpdate: Record<string, unknown> = {};
      const detailUpdate: Record<string, unknown> = {};

      if (data.name !== undefined) productUpdate.name = data.name;
      if (data.suggestedPrice !== undefined) productUpdate.sale_price = data.suggestedPrice;
      if (data.vaccineType !== undefined) productUpdate.tags = [data.vaccineType];

      if (data.laboratoryId !== undefined) detailUpdate.laboratory_id = data.laboratoryId;
      if (data.species !== undefined) detailUpdate.species = data.species;
      if (data.vaccineType !== undefined) detailUpdate.vaccine_type = data.vaccineType;
      if (data.administrationRoute !== undefined)
        detailUpdate.administration_route = data.administrationRoute;
      if (data.minimumAgeMonths !== undefined)
        detailUpdate.minimum_age_months = data.minimumAgeMonths;
      if (data.scheduleDoses !== undefined) detailUpdate.schedule_doses = data.scheduleDoses;
      if (data.scheduleIntervalDays !== undefined)
        detailUpdate.schedule_interval_days = data.scheduleIntervalDays;
      if (data.notes !== undefined) detailUpdate.notes = data.notes;

      const promises: Promise<unknown>[] = [];
      if (Object.keys(productUpdate).length > 0) {
        promises.push(
          actions.execute('products.items.update', { id: productId, data: productUpdate })
        );
      }
      if (Object.keys(detailUpdate).length > 0) {
        promises.push(
          actions.execute('vaccination.catalog.update', { id: detailId, data: detailUpdate })
        );
      }

      await Promise.all(promises);
      await refetch();
    },
    [refetch]
  );

  const toggleActive = useCallback(
    async (productId: string, isActive: boolean): Promise<void> => {
      await actions.execute('products.items.update', {
        id: productId,
        data: { is_active: isActive },
      });
      await refetch();
    },
    [refetch]
  );

  return {
    items,
    filtered,
    loading,
    error,
    filters,
    setFilters,
    refetch,
    create,
    update,
    toggleActive,
  };
}
