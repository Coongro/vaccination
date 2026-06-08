import { localToUTC, addMinutes } from '@coongro/datetime';
import { getHostReact, actions } from '@coongro/plugin-sdk';

import type {
  ApplyProductOption,
  ApplyLoteOption,
  ApplyFormData,
} from '../components/ApplyVaccineDialog.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useRef } = React;

const BATCH_KIND = 'vaccination-batch';

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

/**
 * Registra una aplicación de vacuna: crea el `applied_vaccination` y, si hay lote,
 * descuenta una dosis con un movimiento de stock 'out' (actualiza stock_current).
 * Compartido por el carnet de la ficha y cualquier otro punto de alta.
 */
export async function applyVaccine(data: ApplyFormData): Promise<string> {
  const appliedId = uuid();
  await actions.execute('vaccination.applied.create', {
    data: {
      id: appliedId,
      patient_id: data.patientId,
      product_id: data.productId,
      variant_id: data.variantId,
      applied_date: data.appliedDate,
      weight_kg: data.weightKg,
      staff_id: data.staffId,
      dose_number: null,
      next_dose_date: data.nextDoseDate,
      notes: data.notes,
    },
  });
  if (data.variantId) {
    await actions.execute('products.stock.create', {
      data: {
        id: uuid(),
        product_id: data.productId,
        variant_id: data.variantId,
        type: 'out',
        quantity: '-1',
        reference_type: 'vaccination_application',
      },
    });
  }
  return appliedId;
}

/** Datos mínimos para agendar el turno de una próxima dosis. */
export interface ScheduleNextDoseParams {
  appliedId: string;
  petId: string;
  contactId: string;
  staffId: string | null;
  patientName: string;
  productName: string;
  /** Fecha del turno (date-key 'yyyy-mm-dd'). */
  nextDate: string;
  /** Hora de inicio (HH:mm) — la elige el veterinario. */
  time: string;
  /** Hora de fin (HH:mm) — la elige el veterinario (default: inicio + duración del setting). */
  endTime: string;
  tz: string;
}

/** Duración usada para SUGERIR huecos libres (sugerencia de inicio, no la del turno). */
export const NEXT_DOSE_SLOT_MINUTES = 30;

/** Suma `minutes` a una hora 'HH:mm', con tope en 23:59 (no cruza de día). */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
/** Hora tope (24h) hasta la que buscamos hueco libre antes de aceptar la preferida. */
const NEXT_DOSE_LAST_HOUR = 20;

/**
 * Sugiere la primera franja libre de `NEXT_DOSE_SLOT_MINUTES` en `dateKey` a partir
 * de la hora preferida, evitando turnos existentes en la agenda. Se usa para
 * PRE-CARGAR la hora en el diálogo de agendar (el vet la puede cambiar). Si todo
 * está ocupado hasta `NEXT_DOSE_LAST_HOUR`, devuelve la preferida. Si la agenda no
 * responde, devuelve la preferida sin más.
 */
export async function suggestFreeSlot(
  dateKey: string,
  preferred: string,
  tz: string
): Promise<string> {
  const [ph, pm] = preferred.split(':').map(Number);
  if (!Number.isFinite(ph) || !Number.isFinite(pm)) return preferred;

  let busy: Array<[number, number]> = [];
  try {
    const appts = await actions.execute<
      Array<{ status?: string; event_start_at?: string | null; event_end_at?: string | null }>
    >('appointments.search', { pageSize: 500 });
    busy = (appts ?? [])
      .filter((a) => a.status !== 'cancelled' && a.event_start_at && a.event_end_at)
      .map((a) => [Date.parse(a.event_start_at), Date.parse(a.event_end_at)]);
  } catch {
    return preferred;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  let h = ph;
  let m = pm;
  while (h < NEXT_DOSE_LAST_HOUR) {
    const candidate = `${pad(h)}:${pad(m)}`;
    const start = Date.parse(localToUTC(dateKey, candidate, tz));
    const end = start + NEXT_DOSE_SLOT_MINUTES * 60000;
    const clash = busy.some(([bs, be]) => start < be && end > bs);
    if (!clash) return candidate;
    m += NEXT_DOSE_SLOT_MINUTES;
    if (m >= 60) {
      m -= 60;
      h += 1;
    }
  }
  return preferred;
}

/**
 * Agenda el turno de una próxima dosis como un turno REAL: crea el evento en
 * `calendar.events` (el bloque horario) + el `appointments` (lo que muestra la
 * agenda y linkea contacto/mascota/profesional). Se vinculan a la aplicación
 * via `metadata.vaccination_applied_id` para poder detectar "ya agendada" y
 * deep-linkear desde "Ver turno".
 *
 * Dependencia blanda hacia appointments (string-based): si el plugin no está,
 * el calendar.events queda igual creado y la función no rompe.
 *
 * Devuelve la hora (HH:mm) en la que quedó el turno, para mostrarla en el toast.
 */
export async function scheduleNextDoseAppointment(params: ScheduleNextDoseParams): Promise<string> {
  const time = params.time;
  const startIso = localToUTC(params.nextDate, time, params.tz);
  // Si el fin es inválido o no posterior al inicio, usamos inicio + slot por defecto.
  const endValid = /^\d{2}:\d{2}$/.test(params.endTime) && params.endTime > time;
  const endIso = endValid
    ? localToUTC(params.nextDate, params.endTime, params.tz)
    : addMinutes(startIso, NEXT_DOSE_SLOT_MINUTES);
  let calendarEventId: string | null = null;
  const eventRes = await actions.execute<Array<{ id: string }>>('calendar.events.create', {
    data: {
      title: `Vacuna: ${params.productName} — ${params.patientName}`,
      description: 'Turno de próxima dosis de vacunación',
      start_at: startIso,
      end_at: endIso,
      status: 'scheduled',
      entity_id: params.appliedId,
      entity_type: NEXT_DOSE_ENTITY_TYPE,
    },
  });
  calendarEventId = eventRes?.[0]?.id ?? null;
  await actions.execute('appointments.create', {
    data: {
      contact_id: params.contactId,
      pet_id: params.petId,
      staff_id: params.staffId,
      reason: `Próxima dosis: ${params.productName}`,
      calendar_event_id: calendarEventId,
      metadata: { vaccination_applied_id: params.appliedId, next_dose_date: params.nextDate },
    },
  });
  return time;
}

/** Una aplicación de vacuna con todos sus nombres ya resueltos (cross-plugin). */
export interface AppliedItem {
  id: string;
  patientId: string;
  appliedDate: string;
  patientName: string;
  species: string;
  tutor: string;
  productId: string;
  productName: string;
  variantId: string | null;
  lote: string;
  staffId: string;
  vetName: string;
  weightKg: string | null;
  nextDoseDate: string | null;
  tutorPhone: string | null;
  /** Contacto dueño de la mascota — necesario para crear el turno (appointments.contact_id). */
  ownerContactId: string | null;
  /** Email del tutor (para la ficha de recall). */
  tutorEmail: string | null;
  /** Laboratorio del producto (resuelto del catálogo). */
  labName: string;
  /** Nro. de dosis del esquema, si se registró. */
  doseNumber: number | null;
  /** Notas de la aplicación (reacciones, indicaciones al tutor). */
  notes: string | null;
}

/** Turno ya agendado para la próxima dosis de una aplicación. */
export interface ScheduledNextDose {
  appointmentId: string;
  /** date-key 'yyyy-mm-dd' del turno, para deep-link a la agenda. */
  date: string;
}

interface AppliedRecord {
  id: string;
  patient_id: string;
  product_id: string;
  variant_id: string | null;
  applied_date: string;
  weight_kg: string | null;
  staff_id: string | null;
  next_dose_date: string | null;
  dose_number: number | null;
  notes: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  owner_id: string;
}
interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}
interface Product {
  id: string;
  name: string;
  sale_price: string | null;
}
interface Lab {
  id: string;
  name: string;
}
interface VaccineDetail {
  product_id: string;
  laboratory_id: string;
  schedule_interval_days: number | null;
}
interface Variant {
  id: string;
  product_id: string;
  sku: string | null;
  stock_current: string | null;
  is_active: boolean;
  attributes: Record<string, unknown> | null;
}
interface StaffMember {
  id: string;
  contact_id: string;
}

export interface VaccinationData {
  appliedItems: AppliedItem[];
  /** Productos del catálogo con lab + intervalo (para el form de alta). */
  products: ApplyProductOption[];
  /** Lotes con stock por producto (para elegir al aplicar). */
  lotesByProduct: Record<string, ApplyLoteOption[]>;
  /** Aplicaciones cuya próxima dosis ya tiene turno agendado, indexadas por appliedId. */
  scheduledByApplied: Map<string, ScheduledNextDose>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** entity_type que usamos para vincular un turno con la próxima dosis de una aplicación. */
export const NEXT_DOSE_ENTITY_TYPE = 'vaccination_next_dose';

/**
 * Carga y cruza todo lo que las vistas de vacunación necesitan (aplicaciones +
 * nombres de paciente/tutor/producto/lote/profesional + catálogo y lotes con
 * stock para el alta). Compartido por Aplicadas, el carnet en la ficha y
 * Próximas dosis para no duplicar el data-fetching cross-plugin.
 */
export function useVaccinationData(): VaccinationData {
  const [appliedItems, setAppliedItems] = useState<AppliedItem[]>([]);
  const [products, setProducts] = useState<ApplyProductOption[]>([]);
  const [lotesByProduct, setLotesByProduct] = useState<Record<string, ApplyLoteOption[]>>({});
  const [scheduledByApplied, setScheduledByApplied] = useState<Map<string, ScheduledNextDose>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const reload = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [applied, pets, contacts, productList, variants, staff, details, labs] =
        await Promise.all([
          actions.execute<AppliedRecord[]>('vaccination.applied.list'),
          actions.execute<Pet[]>('patients.pets.list'),
          actions.execute<Contact[]>('contacts.list'),
          actions.execute<Product[]>('products.items.list'),
          actions.execute<Variant[]>('products.variants.list'),
          actions.execute<StaffMember[]>('staff.members.list'),
          actions.execute<VaccineDetail[]>('vaccination.catalog.list'),
          actions.execute<Lab[]>('vaccination.laboratories.list'),
        ]);

      const petById = new Map<string, Pet>();
      for (const p of pets) petById.set(p.id, p);
      const contactNameById = new Map<string, string>();
      const contactPhoneById = new Map<string, string | null>();
      const contactEmailById = new Map<string, string | null>();
      for (const c of contacts) {
        contactNameById.set(c.id, c.name);
        contactPhoneById.set(c.id, c.phone ?? null);
        contactEmailById.set(c.id, c.email ?? null);
      }
      const productNameById = new Map<string, string>();
      const productPriceById = new Map<string, string | null>();
      for (const p of productList) {
        productNameById.set(p.id, p.name);
        productPriceById.set(p.id, p.sale_price ?? null);
      }
      const labNameById = new Map<string, string>();
      for (const l of labs) labNameById.set(l.id, l.name);
      // El nombre del profesional vive en contacts (staff guarda contact_id).
      const staffNameById = new Map<string, string>();
      for (const s of staff) staffNameById.set(s.id, contactNameById.get(s.contact_id) ?? '—');
      const loteByVariantId = new Map<string, string>();
      for (const v of variants) {
        const attrs = v.attributes ?? {};
        loteByVariantId.set(v.id, (attrs.lote as string) ?? v.sku ?? '');
      }

      const detailByProductId = new Map<string, VaccineDetail>();
      for (const d of details) detailByProductId.set(d.product_id, d);

      const productOptions: ApplyProductOption[] = [];
      for (const d of details) {
        const name = productNameById.get(d.product_id);
        if (!name) continue;
        productOptions.push({
          productId: d.product_id,
          name,
          labName: labNameById.get(d.laboratory_id) ?? '',
          scheduleIntervalDays: d.schedule_interval_days,
          salePrice: productPriceById.get(d.product_id) ?? null,
        });
      }
      productOptions.sort((a, b) => a.name.localeCompare(b.name));

      const lotesMap: Record<string, ApplyLoteOption[]> = {};
      for (const v of variants) {
        const attrs = v.attributes ?? {};
        if (attrs.kind !== BATCH_KIND) continue;
        if (!v.is_active) continue;
        if (!detailByProductId.has(v.product_id)) continue;
        const remaining = Number(v.stock_current ?? 0);
        if (remaining <= 0) continue;
        (lotesMap[v.product_id] ??= []).push({
          variantId: v.id,
          lote: (attrs.lote as string) ?? v.sku ?? '',
          expiresAt: (attrs.expires_at as string) ?? '',
          remaining,
        });
      }

      const merged: AppliedItem[] = applied.map((a) => {
        const pet = petById.get(a.patient_id);
        return {
          id: a.id,
          patientId: a.patient_id,
          appliedDate: a.applied_date,
          patientName: pet?.name ?? '—',
          species: pet?.species ?? '',
          tutor: pet ? (contactNameById.get(pet.owner_id) ?? '—') : '—',
          productId: a.product_id,
          productName: productNameById.get(a.product_id) ?? '—',
          variantId: a.variant_id,
          lote: a.variant_id ? (loteByVariantId.get(a.variant_id) ?? '—') : '—',
          staffId: a.staff_id ?? '',
          vetName: a.staff_id ? (staffNameById.get(a.staff_id) ?? '—') : '—',
          weightKg: a.weight_kg,
          nextDoseDate: a.next_dose_date,
          tutorPhone: pet ? (contactPhoneById.get(pet.owner_id) ?? null) : null,
          ownerContactId: pet?.owner_id ?? null,
          tutorEmail: pet ? (contactEmailById.get(pet.owner_id) ?? null) : null,
          labName: labNameById.get(detailByProductId.get(a.product_id)?.laboratory_id ?? '') ?? '',
          doseNumber: a.dose_number,
          notes: a.notes,
        };
      });

      // Turnos ya agendados: los buscamos en appointments (lo que muestra la agenda),
      // vinculados a la aplicación via metadata.vaccination_applied_id. appointments es
      // opcional — si no está instalado, no rompe (las dosis quedan "por agendar").
      const scheduled = new Map<string, ScheduledNextDose>();
      try {
        const appts = await actions.execute<
          Array<{ id: string; status?: string; metadata?: Record<string, unknown> | null }>
        >('appointments.search', { pageSize: 500 });
        for (const ap of appts ?? []) {
          if (ap.status === 'cancelled') continue;
          const appliedId = ap.metadata?.vaccination_applied_id as string | undefined;
          const date = ap.metadata?.next_dose_date as string | undefined;
          if (appliedId && date) scheduled.set(appliedId, { appointmentId: ap.id, date });
        }
      } catch {
        /* appointments no disponible en el tenant */
      }

      setAppliedItems(merged);
      setProducts(productOptions);
      setLotesByProduct(lotesMap);
      setScheduledByApplied(scheduled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos de vacunación');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { appliedItems, products, lotesByProduct, scheduledByApplied, loading, error, reload };
}
