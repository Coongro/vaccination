import { getHostReact, getHostUI, events, actions } from '@coongro/plugin-sdk';
import { useTenantTimezone } from '@coongro/calendar';

const UI = getHostUI();
import {
  useVaccinationData,
  applyVaccine,
  scheduleNextDoseAppointment,
  suggestFreeSlot,
  addMinutesToTime,
} from '../../data/useVaccinationData.js';
import { chargeAppliedVaccine } from '../../data/billing.js';
import { useVaccinationSettings } from '../../data/useVaccinationSettings.js';
import { formatDate } from '../../components/lote-status.js';

const React = getHostReact();
const { useState, useMemo, useEffect, useRef, useCallback } = React;
const h = React.createElement;

const MODULE_ID = '@coongro/vaccination';

function toast(title: string, message: string, type: 'success' | 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | { show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return '';
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

interface PendingVaccine {
  key: string;
  productId: string;
  productName: string;
  variantId: string;
  lote: string;
  expiresAt: string;
  intervalDays: number | null;
  salePrice: string | null;
}

/**
 * Sección de vacunas dentro del form de consulta (contribución a
 * consultations.form.open). El vet suma las vacunas que aplica en la visita;
 * al GUARDAR la consulta (evento consultations.records.create) se registran
 * en el historial vacunal + descuentan el lote, con fecha/peso/profesional de
 * la consulta. consultations NO depende de vaccination (sólo emite el evento).
 */
export function ConsultationVaccinesSection(_props: Record<string, unknown>) {
  const { products, lotesByProduct, reload } = useVaccinationData();
  const { nextDoseMode: mode, nextDoseTime, nextDoseDuration } = useVaccinationSettings();
  const tz = useTenantTimezone();

  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [pending, setPending] = useState<PendingVaccine[]>([]);
  const pendingRef = useRef<PendingVaccine[]>([]);
  // El callback del evento vive fuera del ciclo de render; leemos mode/tz/hora/duración por ref.
  const modeRef = useRef(mode);
  const tzRef = useRef(tz);
  const timeRef = useRef(nextDoseTime);
  const durationRef = useRef(nextDoseDuration);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    tzRef.current = tz;
  }, [tz]);
  useEffect(() => {
    timeRef.current = nextDoseTime;
  }, [nextDoseTime]);
  useEffect(() => {
    durationRef.current = nextDoseDuration;
  }, [nextDoseDuration]);

  const productsWithLotes = useMemo(
    () => products.filter((p) => (lotesByProduct[p.productId]?.length ?? 0) > 0),
    [products, lotesByProduct]
  );
  const availableLotes = useMemo(
    () => (productId ? (lotesByProduct[productId] ?? []) : []),
    [lotesByProduct, productId]
  );

  const addVaccine = useCallback(() => {
    if (!productId || !variantId) return;
    const product = products.find((p) => p.productId === productId);
    const lote = availableLotes.find((l) => l.variantId === variantId);
    if (!product || !lote) return;
    setPending((prev) => [
      ...prev,
      {
        key: `${productId}|${variantId}|${prev.length}`,
        productId,
        productName: product.name,
        variantId,
        lote: lote.lote,
        expiresAt: lote.expiresAt,
        intervalDays: product.scheduleIntervalDays,
        salePrice: product.salePrice,
      },
    ]);
    setProductId('');
    setVariantId('');
  }, [productId, variantId, products, availableLotes]);

  // Al guardarse la consulta, registrar cada vacuna pendiente.
  useEffect(() => {
    return events.on(
      'consultations.records.create',
      (payload: { actionId: string; args: unknown; result: unknown }) => {
        const list = pendingRef.current;
        if (list.length === 0) return;
        const row = (payload.result as Array<Record<string, unknown>> | undefined)?.[0];
        if (!row) return;
        const patientId = row.pet_id as string | undefined;
        if (!patientId) return;
        const appliedDate = ((row.date as string) ?? new Date().toISOString()).slice(0, 10);
        const staffId = (row.staff_id as string | null) ?? null;
        const weightKg = row.weight_kg != null ? String(row.weight_kg) : null;

        void (async () => {
          const auto = modeRef.current === 'auto';
          const consultationId = (row.id as string | undefined) ?? null;
          // Dueño de la mascota — lo necesitamos para el cobro (contact de la cuenta)
          // y para el agendado en modo auto. Lo resolvemos una sola vez.
          let owner: { ownerId: string | null; name: string } = { ownerId: null, name: '' };
          try {
            const pets = await actions.execute<
              Array<{ id: string; name: string; owner_id: string }>
            >('patients.pets.list');
            const pet = pets?.find((p) => p.id === patientId);
            owner = { ownerId: pet?.owner_id ?? null, name: pet?.name ?? '' };
          } catch {
            /* sin pets: cobramos sin contacto y no agendamos */
          }

          for (const v of list) {
            const nextDoseDate = v.intervalDays ? addDays(appliedDate, v.intervalDays) : null;
            const appliedId = await applyVaccine({
              patientId,
              productId: v.productId,
              variantId: v.variantId,
              appliedDate,
              weightKg,
              staffId,
              nextDoseDate,
              notes: null,
            });

            // Cobro: línea de la vacuna en la cuenta de esta consulta (mismo ticket).
            void chargeAppliedVaccine({
              appliedId,
              productId: v.productId,
              productName: v.productName,
              salePrice: v.salePrice,
              contactId: owner.ownerId,
              petId: patientId,
              consultationId,
            });

            // "ask" no aplica en batch (no se puede preguntar mid-guardado) → como "off".
            if (auto && nextDoseDate && owner.ownerId) {
              try {
                const time = await suggestFreeSlot(nextDoseDate, timeRef.current, tzRef.current);
                await scheduleNextDoseAppointment({
                  appliedId,
                  petId: patientId,
                  contactId: owner.ownerId,
                  staffId,
                  patientName: owner.name,
                  productName: v.productName,
                  nextDate: nextDoseDate,
                  time,
                  endTime: addMinutesToTime(time, durationRef.current),
                  tz: tzRef.current,
                });
              } catch {
                /* el turno queda pendiente en Próximas dosis */
              }
            }
          }
          toast(
            'Vacunas registradas',
            `${list.length} ${list.length === 1 ? 'vacuna aplicada' : 'vacunas aplicadas'} en el carnet`,
            'success'
          );
          setPending([]);
          await reload();
        })();
      }
    );
  }, [reload]);

  return h(
    'div',
    { className: 'flex flex-col gap-3' },

    h(
      'p',
      { className: 'text-[13px] text-cg-text-muted' },
      'Vacunas aplicadas en esta consulta. Se registran en el carnet del paciente al guardar.'
    ),

    // Selector producto + lote + agregar
    h(
      'div',
      { className: 'flex gap-2 flex-wrap items-end' },
      h(
        'div',
        { className: 'flex-1 min-w-[200px]' },
        h(
          UI.Select,
          {
            value: productId,
            onValueChange: (v: string) => {
              setProductId(v);
              setVariantId('');
            },
            placeholder: 'Vacuna del catálogo…',
            debounceMs: 0,
          } as any,
          ...productsWithLotes.map((p) =>
            h(UI.SelectItem, { key: p.productId, value: p.productId } as any, p.name)
          )
        )
      ),
      h(
        'div',
        { className: 'flex-1 min-w-[200px]' },
        h(
          UI.Select,
          {
            value: variantId,
            onValueChange: (v: string) => setVariantId(v),
            placeholder: 'Lote…',
            disabled: !productId,
            debounceMs: 0,
          } as any,
          ...availableLotes.map((l) =>
            h(
              UI.SelectItem,
              { key: l.variantId, value: l.variantId } as any,
              `${l.lote} · vence ${formatDate(l.expiresAt)} · ${l.remaining} disp.`
            )
          )
        )
      ),
      h(
        UI.Button,
        { variant: 'outline', size: 'sm', disabled: !productId || !variantId, onClick: addVaccine } as any,
        h(UI.DynamicIcon, { icon: 'Plus', size: 13 } as any),
        ' Agregar'
      )
    ),

    productsWithLotes.length === 0 &&
      h(
        'p',
        { className: 'text-xs text-cg-text-muted' },
        'No hay vacunas con lote en stock. Cargá lotes en Vacunación → Lotes.'
      ),

    // Vacunas agregadas
    pending.length > 0 &&
      h(
        'div',
        { className: 'flex flex-col gap-1.5 rounded-lg border border-cg-border p-3' },
        ...pending.map((v) =>
          h(
            'div',
            { key: v.key, className: 'flex items-center justify-between gap-3 text-[13px]' },
            h(
              'div',
              { className: 'flex items-center gap-2 min-w-0' },
              h(UI.DynamicIcon, { icon: 'Syringe', size: 13, color: 'var(--cg-brand)' } as any),
              h('span', { className: 'font-medium' }, v.productName),
              h('span', { className: 'font-mono text-cg-text-muted text-xs' }, v.lote)
            ),
            h(
              UI.IconButton,
              {
                variant: 'ghost',
                size: 'sm',
                'aria-label': `Quitar ${v.productName}`,
                onClick: () => setPending((prev) => prev.filter((x) => x.key !== v.key)),
              } as any,
              h(UI.DynamicIcon, { icon: 'X', size: 13 } as any)
            )
          )
        )
      )
  );
}
