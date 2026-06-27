import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { VaccineComponentRow } from '../schema/vaccine-component.js';
import type { VaccineDetailRow } from '../schema/vaccine-detail.js';
import type { VaccineType, AdministrationRoute } from '../types/vaccination.js';
import { uuid } from '../utils/uuid.js';

const { useState, useEffect, useCallback, useRef } = getHostReact();

/** Un agente etiológico / cepa de la composición de la vacuna. */
export interface VaccineAgent {
  agent: string;
  rawStrength?: string | null;
  source?: string | null;
}

/** Inserta los agentes de una vacuna, con `position` estable por orden. */
export async function createVaccineAgents(detailId: string, agents: VaccineAgent[]): Promise<void> {
  await Promise.all(
    agents.map((a, i) =>
      actions.execute('vaccination.components.create', {
        data: {
          id: uuid(),
          vaccine_detail_id: detailId,
          agent: a.agent,
          raw_strength: a.rawStrength ?? null,
          source: a.source ?? null,
          position: i,
        },
      })
    )
  );
}

/**
 * Reconcilia los agentes al editar: crea los nuevos PRIMERO y recién después
 * borra los viejos. No es transaccional entre acciones; en este orden, un fallo a
 * mitad deja agentes de más (recuperable) en vez de dejar la vacuna sin
 * composición. Mismo criterio que la composición de medicamentos en vet-pharmacy.
 */
export async function reconcileVaccineAgents(
  detailId: string,
  agents: VaccineAgent[]
): Promise<void> {
  const existing = await actions.execute<VaccineComponentRow[]>(
    'vaccination.components.listByDetail',
    { vaccineDetailId: detailId }
  );
  // Si la lectura falla o no devuelve un array, NO reconciliar: hacerlo contra un
  // `[]` adivinado crearía los nuevos agentes y no borraría los viejos → composición
  // DUPLICADA, y encima reportando "éxito". Mejor abortar y que el caller avise.
  if (!Array.isArray(existing)) {
    throw new Error(
      'No se pudo leer la composición actual; no se guardó para no duplicar los agentes.'
    );
  }
  const oldIds = existing.map((c) => c.id);
  await createVaccineAgents(detailId, agents);
  await Promise.all(oldIds.map((id) => actions.execute('vaccination.components.delete', { id })));
}

interface ProductRow {
  id: string;
  name: string;
  sale_price: string | null;
  purchase_price: string | null;
  is_active: boolean;
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
  // ── Datos del vademécum (SENASA) ──
  senasaRegistration: string | null;
  presentation: string | null;
  indications: string | null;
  senasaStatus: string | null;
  components: VaccineAgent[];
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
  senasaRegistration?: string | null;
  presentation?: string | null;
  indications?: string | null;
  senasaStatus?: string | null;
  components?: VaccineAgent[];
}

export type UpdateVaccineData = Partial<CreateVaccineData>;

export interface UseVaccineCatalogResult {
  items: VaccineCatalogItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreateVaccineData) => Promise<void>;
  update: (productId: string, detailId: string, data: UpdateVaccineData) => Promise<void>;
  toggleActive: (productId: string, isActive: boolean) => Promise<void>;
}

/**
 * Fuente única de los datos del catálogo de vacunas: une products + detalle +
 * composición (agentes), y expone el CRUD. Lo consume la vista del catálogo —
 * que aporta lo presentacional (laboratorios, filtros/orden, toasts). El filtrado
 * NO vive acá a propósito: la vista lo hace más rico (multi-select, orden), así
 * que el hook se queda en data+CRUD y no duplica esa lógica.
 *
 * Los toasts tampoco viven acá (son presentación): `create`/`update` resuelven en
 * éxito y LANZAN en error, para que la vista muestre el toast que corresponda.
 */
export function useVaccineCatalog(): UseVaccineCatalogResult {
  const [items, setItems] = useState<VaccineCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const [products, details, components] = await Promise.all([
        actions.execute<ProductRow[]>('products.items.list'),
        actions.execute<VaccineDetailRow[]>('vaccination.catalog.list'),
        actions.execute<VaccineComponentRow[]>('vaccination.components.list'),
      ]);

      const detailByProductId = new Map<string, VaccineDetailRow>();
      for (const d of details) detailByProductId.set(d.product_id, d);
      // Agentes agrupados por detalle (el repo ya los devuelve ordenados por position).
      const agentsByDetailId = new Map<string, VaccineAgent[]>();
      for (const c of components) {
        const list = agentsByDetailId.get(c.vaccine_detail_id) ?? [];
        list.push({ agent: c.agent, rawStrength: c.raw_strength, source: c.source });
        agentsByDetailId.set(c.vaccine_detail_id, list);
      }

      // El producto sin detalle es de otro plugin (la tabla products es compartida):
      // se omite porque este catálogo es solo de vacunas.
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
          senasaRegistration: detail.senasa_registration,
          presentation: detail.presentation,
          indications: detail.indications,
          senasaStatus: detail.senasa_status,
          components: agentsByDetailId.get(detail.id) ?? [],
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

  const create = useCallback(
    async (data: CreateVaccineData): Promise<void> => {
      const productId = uuid();
      const detailId = uuid();

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
          id: detailId,
          product_id: productId,
          laboratory_id: data.laboratoryId,
          species: data.species,
          vaccine_type: data.vaccineType,
          administration_route: data.administrationRoute,
          minimum_age_months: data.minimumAgeMonths ?? null,
          schedule_doses: data.scheduleDoses ?? null,
          schedule_interval_days: data.scheduleIntervalDays ?? null,
          senasa_registration: data.senasaRegistration ?? null,
          presentation: data.presentation ?? null,
          indications: data.indications ?? null,
          senasa_status: data.senasaStatus ?? null,
          notes: data.notes ?? null,
        },
      });

      await createVaccineAgents(detailId, data.components ?? []);
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
      if (data.senasaRegistration !== undefined)
        detailUpdate.senasa_registration = data.senasaRegistration;
      if (data.presentation !== undefined) detailUpdate.presentation = data.presentation;
      if (data.indications !== undefined) detailUpdate.indications = data.indications;
      if (data.senasaStatus !== undefined) detailUpdate.senasa_status = data.senasaStatus;
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
      // Reconciliar agentes solo si el caller los envió (undefined = no tocar).
      if (data.components !== undefined) await reconcileVaccineAgents(detailId, data.components);
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

  return { items, loading, error, refetch, create, update, toggleActive };
}
