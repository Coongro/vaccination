import { formatSpecies } from '@coongro/patients';
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

const UI = getHostUI();
import { ApplyVaccineDialog } from '../../components/ApplyVaccineDialog.js';
import type { ApplyFormData } from '../../components/ApplyVaccineDialog.js';
import { formatDate } from '../../components/lote-status.js';
import { ScheduleNextDoseDialog } from '../../components/ScheduleNextDoseDialog.js';
import { chargeAppliedVaccine } from '../../data/billing.js';
import { useNextDoseScheduler } from '../../data/useNextDoseScheduler.js';
import { useVaccinationData, applyVaccine } from '../../data/useVaccinationData.js';
import { useVaccinationSettings } from '../../data/useVaccinationSettings.js';

const React = getHostReact();
const { useState, useMemo, useCallback } = React;
const h = React.createElement;

const MODULE_ID = '@coongro/vaccination';

function toast(title: string, message: string, type: 'success' | 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = (globalThis as any).coongro?.toast as
    | {
        show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void;
      }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Carnet de vacunación del paciente — contribución a la ficha (patients.detail.open).
 * Recibe { petId, pet } como props desde el host. Lista las dosis aplicadas a ese
 * paciente + botón "Aplicar vacuna" (paciente fijo). El alta vive acá, no en Aplicadas.
 */
export function VaccinationSection(props: Record<string, unknown>): ReturnType<typeof h> | null {
  const petId = props.petId as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pet = props.pet as any;
  const petName = pet?.name as string | undefined;
  const petWeight = pet?.weight_kg != null ? String(pet.weight_kg) : undefined;
  const ownerContactId = (pet?.owner_id as string | undefined) ?? null;

  const { appliedItems, products, lotesByProduct, loading, reload } = useVaccinationData();
  const { nextDoseMode: mode } = useVaccinationSettings();
  const { openSchedule, scheduleAuto, scheduleDialogProps } = useNextDoseScheduler(reload);
  const [showForm, setShowForm] = useState(false);

  const rows = useMemo(
    () =>
      appliedItems
        .filter((a) => a.patientId === petId)
        .sort((a, b) => (a.appliedDate < b.appliedDate ? 1 : -1)),
    [appliedItems, petId]
  );

  // Próxima dosis: la más cercana a futuro entre las aplicaciones del paciente.
  const nextDose = useMemo(() => {
    const today = todayKey();
    const upcoming = rows
      .map((r) => r.nextDoseDate)
      .filter((d): d is string => !!d && d >= today)
      .sort();
    return upcoming[0] ?? null;
  }, [rows]);

  const handleApply = useCallback(
    async (data: ApplyFormData) => {
      const appliedId = await applyVaccine(data);
      toast('Aplicación registrada', 'La dosis quedó asentada y descontada del lote.', 'success');

      // Cobro: desde la ficha es venta de mostrador (sin consulta). Precio = catálogo.
      const prod = products.find((p) => p.productId === data.productId);
      void chargeAppliedVaccine({
        appliedId,
        productId: data.productId,
        productName: prod?.name ?? 'Vacuna',
        salePrice: prod?.salePrice ?? null,
        contactId: ownerContactId,
        petId: petId ?? '',
        consultationId: null,
      });

      await reload();

      // Turno de la próxima dosis según el setting (off/ask/auto).
      if (mode === 'off' || !data.nextDoseDate || !ownerContactId || !petId) return;
      const input = {
        appliedId,
        petId,
        contactId: ownerContactId,
        patientName: petName ?? '',
        productName: products.find((p) => p.productId === data.productId)?.name ?? 'Vacuna',
        nextDate: data.nextDoseDate,
        defaultStaffId: data.staffId,
        species: pet?.species as string | undefined,
      };
      if (mode === 'auto') void scheduleAuto(input);
      else openSchedule(input); // mode === 'ask' → abre el diálogo de fecha/hora
    },
    [reload, products, mode, ownerContactId, petId, petName, scheduleAuto, openSchedule]
  );

  // Carnet imprimible (COONG-164): abre una ventana con layout A4 B&N y print.
  const printCarnet = useCallback(() => {
    const win = window.open('', '_blank', 'width=820,height=920');
    if (!win) {
      toast('No se pudo abrir', 'Permití pop-ups para imprimir el carnet.', 'info');
      return;
    }
    const esc = (s: string | null | undefined) =>
      (s ?? '').replace(
        /[&<>"]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
      );
    const tutor = rows[0]?.tutor ?? '—';
    const speciesLabel = rows[0]?.species ? formatSpecies(rows[0].species) : '';
    const body = rows
      .map(
        (r) =>
          `<tr><td class="m">${formatDate(r.appliedDate)}</td><td>${esc(r.productName)}</td><td class="m">${esc(r.lote)}</td><td class="m">${r.weightKg ? esc(r.weightKg) + ' kg' : '—'}</td><td>${esc(r.vetName)}</td></tr>`
      )
      .join('');
    win.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Carnet de vacunación — ${esc(petName)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:32px}
  h1{font-size:20px;margin:0 0 2px} .sub{font-size:12px;color:#555;margin:0 0 18px}
  .pat{border:1px solid #ccc;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:13px}
  .pat b{font-size:15px} table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #ddd} th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#555;border-bottom:1px solid #999}
  .m{font-family:"Courier New",monospace} .foot{margin-top:24px;font-size:10px;color:#888}
  @media print{body{padding:0}}
</style></head><body>
  <h1>Carnet de vacunación</h1>
  <p class="sub">Emitido ${formatDate(todayKey())}</p>
  <div class="pat"><b>${esc(petName)}</b>${speciesLabel ? ' · ' + esc(speciesLabel) : ''}<br>Dueño: ${esc(tutor)}</div>
  <table><thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Peso</th><th>Profesional</th></tr></thead>
  <tbody>${body || '<tr><td colspan="5">Sin aplicaciones registradas.</td></tr>'}</tbody></table>
  <p class="foot">Documento operativo sin valor legal. Generado por Coongro.</p>
  <script>window.onload=function(){window.print()}</script>
</body></html>`
    );
    win.document.close();
  }, [rows, petName]);

  if (!petId) return null;

  const COL = 'grid grid-cols-[110px_1.4fr_1fr_80px_1fr] gap-3 items-center';

  return h(
    'div',
    { className: 'flex flex-col gap-3' },

    // Encabezado: próxima dosis + acción
    h(
      'div',
      { className: 'flex items-center justify-between gap-3' },
      nextDose
        ? h(UI.Badge, { variant: 'warning' } as any, `Próxima dosis: ${formatDate(nextDose)}`)
        : h('span', { className: 'text-xs text-cg-text-muted' }, 'Sin próxima dosis pendiente'),
      h(
        'div',
        { className: 'flex gap-2' },
        h(
          UI.Button,
          {
            variant: 'outline',
            size: 'sm',
            disabled: rows.length === 0,
            onClick: printCarnet,
          } as any,
          h(UI.DynamicIcon, { icon: 'Printer', size: 13 } as any),
          ' Imprimir carnet'
        ),
        h(
          UI.Button,
          { variant: 'brand', size: 'sm', onClick: () => setShowForm(true) } as any,
          h(UI.DynamicIcon, { icon: 'Plus', size: 13 } as any),
          ' Aplicar vacuna'
        )
      )
    ),

    // Carnet
    loading
      ? h('p', { className: 'text-sm text-cg-text-muted py-4' }, 'Cargando…')
      : rows.length === 0
        ? h(
            'div',
            {
              className:
                'rounded-lg border border-dashed border-cg-border p-6 text-center text-sm text-cg-text-muted',
            },
            'Este paciente todavía no tiene vacunas registradas.'
          )
        : h(
            'div',
            { className: 'rounded-lg border border-cg-border overflow-hidden' },
            h(
              'div',
              {
                className: `${COL} px-4 py-2 bg-cg-bg-secondary text-[11px] font-bold uppercase tracking-wide text-cg-text-muted`,
              },
              h('span', null, 'Fecha'),
              h('span', null, 'Producto'),
              h('span', null, 'Lote'),
              h('span', null, 'Peso'),
              h('span', null, 'Profesional')
            ),
            ...rows.map((r, i) =>
              h(
                'div',
                {
                  key: r.id,
                  className: `${COL} px-4 py-2.5 text-[13px] text-cg-text ${
                    i < rows.length - 1 ? 'border-b border-cg-border' : ''
                  }`,
                },
                h('span', { className: 'font-mono text-cg-text-muted' }, formatDate(r.appliedDate)),
                h('span', { className: 'font-medium' }, r.productName),
                h('span', { className: 'font-mono text-cg-text-muted' }, r.lote),
                h(
                  'span',
                  { className: 'font-mono text-cg-text-muted' },
                  r.weightKg ? `${r.weightKg} kg` : '—'
                ),
                h('span', { className: 'text-cg-text-muted' }, r.vetName)
              )
            )
          ),

    // Alta (paciente fijo)
    h(ApplyVaccineDialog, {
      open: showForm,
      onClose: () => setShowForm(false),
      onSuccess: () => setShowForm(false),
      products,
      lotesByProduct,
      onSubmit: handleApply,
      fixedPatientId: petId,
      fixedPatientLabel: petName,
      fixedPatientWeight: petWeight,
    }),

    // Turno de la próxima dosis (modo "ask" / acción manual): elegir fecha y hora.
    h(ScheduleNextDoseDialog, scheduleDialogProps)
  );
}
