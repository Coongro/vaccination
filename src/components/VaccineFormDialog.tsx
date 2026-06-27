import { formatSpecies } from '@coongro/patients';
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';
import { CatalogSearch, LaboratorySelect } from '@coongro/vademecum';
import type { CatalogProductDetail } from '@coongro/vademecum';

import type { VaccineCatalogItem, CreateVaccineData } from '../hooks/useVaccineCatalog.js';
import type { VaccineType, AdministrationRoute } from '../types/vaccination.js';
import { VACCINE_TYPE_LABELS, ADMINISTRATION_ROUTE_LABELS } from '../types/vaccination.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

/** Toast del host (primitivo de la plataforma), para avisar fallos del guardado. */
function hostToast(title: string, message: string, type: 'info' | 'error'): void {
  const host = (globalThis as { coongro?: { toast?: { show?: (o: unknown) => void } } }).coongro;
  host?.toast?.show?.({ title, message, type });
}

interface VaccineFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableSpecies: string[];
  defaultSpecies?: string;
  vaccine?: VaccineCatalogItem | null;
  onSubmit: (data: CreateVaccineData) => Promise<void>;
}

/** Fila editable de la composición: un agente etiológico/cepa + su título crudo. */
interface AgentRow {
  agent: string;
  rawStrength: string;
  /** Origen ('senasa' si vino del autofill); se preserva al editar. */
  source?: string | null;
}

interface FormState {
  name: string;
  laboratoryId: string;
  species: string[];
  vaccineType: VaccineType;
  administrationRoute: AdministrationRoute;
  minimumAgeMonths: string;
  scheduleDoses: string;
  scheduleIntervalDays: string;
  suggestedPrice: string;
  notes: string;
  // ── Datos del vademécum (autorrellenados, editables) ──
  senasaRegistration: string;
  presentation: string;
  indications: string;
  components: AgentRow[];
  /** Vigencia en SENASA al cargar ('active'/'discontinued'/'unknown'); read-only. */
  senasaStatus: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  laboratoryId: '',
  species: [],
  vaccineType: 'core',
  administrationRoute: 'subcutaneous',
  minimumAgeMonths: '',
  scheduleDoses: '',
  scheduleIntervalDays: '',
  suggestedPrice: '',
  notes: '',
  senasaRegistration: '',
  presentation: '',
  indications: '',
  components: [],
  senasaStatus: '',
};

function vaccineToForm(v: VaccineCatalogItem): FormState {
  return {
    name: v.name,
    laboratoryId: v.laboratoryId,
    species: v.species,
    vaccineType: v.vaccineType,
    administrationRoute: v.administrationRoute,
    minimumAgeMonths: v.minimumAgeMonths?.toString() ?? '',
    scheduleDoses: v.scheduleDoses?.toString() ?? '',
    scheduleIntervalDays: v.scheduleIntervalDays?.toString() ?? '',
    suggestedPrice: v.suggestedPrice ?? '',
    notes: v.notes ?? '',
    senasaRegistration: v.senasaRegistration ?? '',
    presentation: v.presentation ?? '',
    indications: v.indications ?? '',
    components: (v.components ?? []).map((c) => ({
      agent: c.agent,
      rawStrength: c.rawStrength ?? '',
      source: c.source,
    })),
    senasaStatus: v.senasaStatus ?? '',
  };
}

function formToData(form: FormState): CreateVaccineData {
  return {
    name: form.name.trim(),
    laboratoryId: form.laboratoryId,
    species: form.species,
    vaccineType: form.vaccineType,
    administrationRoute: form.administrationRoute,
    minimumAgeMonths: form.minimumAgeMonths ? parseInt(form.minimumAgeMonths, 10) : null,
    scheduleDoses: form.scheduleDoses ? parseInt(form.scheduleDoses, 10) : null,
    scheduleIntervalDays: form.scheduleIntervalDays
      ? parseInt(form.scheduleIntervalDays, 10)
      : null,
    suggestedPrice: form.suggestedPrice || null,
    notes: form.notes.trim() || null,
    senasaRegistration: form.senasaRegistration.trim() || null,
    presentation: form.presentation.trim() || null,
    indications: form.indications.trim() || null,
    senasaStatus: form.senasaStatus || null,
    components: form.components
      .map((c) => ({
        agent: c.agent.trim(),
        rawStrength: c.rawStrength.trim() || null,
        source: c.source ?? null,
      }))
      .filter((c) => c.agent),
  };
}

// ─── Autofill desde el vademécum (SENASA) ────────────────────────────────────
// Mapeos del modelo común al form de vacuna. El buscador en sí es compartido
// (@coongro/vademecum); lo específico de Vacunación es CÓMO se prellena cada
// campo (distinto de Farmacia: vacunas se agrupan por especie/vía/tipo).

/**
 * Mapea la taxonomía de especies de SENASA (mayúscula/plural, incluye ganado) a
 * los códigos de Pacientes (dog/cat/…). El ganado sin equivalente de mascota cae
 * en 'other'. Es una heurística chica y propia de este dominio; vet-pharmacy
 * tiene su gemela hasta que exista un normalizador de especies compartido
 * (taxonomía de Pacientes), refactor que excede este ticket.
 */
function senasaSpeciesToCode(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes('canino') || t.includes('perro')) return 'dog';
  if (t.includes('felino') || t.includes('gato')) return 'cat';
  if (t.includes('ave') || t.includes('avi')) return 'bird';
  if (t.includes('reptil')) return 'reptile';
  if (t.includes('roedor')) return 'rodent';
  return 'other';
}

/** Vías de SENASA (texto libre) → enum de vacuna. Sin match claro → 'other'. */
function senasaRouteToEnum(routes: string[]): AdministrationRoute {
  const joined = routes.join(' ').toLowerCase();
  if (/subcut|s\.?c\.?/.test(joined)) return 'subcutaneous';
  if (/intramus|i\.?m\.?/.test(joined)) return 'intramuscular';
  if (/intranas|nasal/.test(joined)) return 'intranasal';
  if (/oral|boca|bebida|agua/.test(joined)) return 'oral';
  return 'other';
}

/**
 * Tipo de vacuna: SENASA no lo expone. Se infiere 'rabies' por nombre/antígeno
 * (la antirrábica es la única con régimen legal distinto). El resto queda en
 * `null` para no pisar la elección del usuario con una adivinanza.
 */
function detectVaccineType(detail: CatalogProductDetail): VaccineType | null {
  const hay = [detail.commercialName, ...detail.composition.map((c) => c.substance)]
    .join(' ')
    .toLowerCase();
  if (/rabi|rábic|rabic/.test(hay)) return 'rabies';
  return null;
}

const SPELLED_NUMBERS: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
};

/**
 * Esquema de dosis best-effort desde el texto de indicaciones de SENASA (ej.
 * "Aplicar dos dosis con 20-30 días de intervalo"). El texto es LIBRE, así que el
 * diseño es FAIL-SAFE: ante la duda no rellena, y un valor improbable se descarta.
 *
 * Clave para evitar falsos positivos del intervalo: un "N días" suelto NO se toma
 * (en SENASA aparece como edad —"a partir de los 60 días de edad"—, espera de
 * faena —"pre-faena: 14 días"— o incubación). Solo se acepta el intervalo cuando
 * está atado a la pauta de dosis: "…N días de intervalo", "intervalo de N días",
 * o tras "revacunar/refuerzo/repetir/segunda dosis/cada". Validado contra 80
 * vacunas reales: 0 falsos positivos. Acotado a rangos plausibles (dosis 1..6,
 * intervalo 1..120). Igual el vet lo revisa (aviso "sugerido" en el form).
 */
const MAX_DOSES = 6;
const MAX_INTERVAL_DAYS = 120;

function parseSchedule(text?: string): { doses?: number; intervalDays?: number } {
  if (!text) return {};
  const t = text.toLowerCase();
  let doses: number | undefined;
  const mDigit = t.match(/(\d+)\s*dosis/);
  if (mDigit) doses = parseInt(mDigit[1], 10);
  else {
    const mSpell = t.match(/\b(un|una|dos|tres|cuatro|cinco|seis)\s+dosis/);
    if (mSpell) doses = SPELLED_NUMBERS[mSpell[1]];
  }
  // Intervalo SOLO en contexto de dosis (ver doc): toma el primer nº de un rango.
  const mInt =
    t.match(/(\d+)\s*(?:[-–a]\s*\d+\s*)?d[ií]as\s+de\s+intervalo/) ??
    t.match(/intervalo\s+de\s+(\d+)\s*(?:[-–a]\s*\d+\s*)?d[ií]as/) ??
    t.match(
      /(?:revacun\w*|refuerzo|repetir|segunda\s+dosis|2da\.?\s*dosis|2[°ª]\s*dosis|cada)[^.]{0,40}?(\d+)\s*(?:[-–a]\s*\d+\s*)?d[ií]as/
    );
  let intervalDays: number | undefined = mInt ? parseInt(mInt[1], 10) : undefined;
  if (doses !== undefined && (doses < 1 || doses > MAX_DOSES)) doses = undefined;
  if (intervalDays !== undefined && (intervalDays < 1 || intervalDays > MAX_INTERVAL_DAYS))
    intervalDays = undefined;
  return { doses, intervalDays };
}

const MAX_AGE_MONTHS = 72;

/**
 * Edad mínima en meses best-effort desde el texto de SENASA (ej. "a bovinos
 * mayores de 3 meses de edad", "a partir de los 2 meses"). Convierte semanas/años
 * a meses y acota a un rango plausible (0..72). Mismo criterio prudente que la
 * dosis: ante la duda no rellena.
 */
function parseMinAge(text?: string): number | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  // Acepta un rango y toma el límite bajo: "60-90 días" / "2 a 3 meses" → 60 / 2.
  const m = t.match(
    /(?:mayores?\s+de|a\s+partir\s+de(?:\s+los)?|desde(?:\s+los|\s+las)?)\s+(\d+)\s*(?:[-–a]\s*\d+\s*)?(mes|semana|año|anio|d[ií]a)/
  );
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  let months: number;
  if (unit.startsWith('mes')) months = n;
  else if (unit.startsWith('semana')) months = Math.round(n / 4.3);
  else if (unit.startsWith('año') || unit.startsWith('anio')) months = n * 12;
  else months = Math.round(n / 30); // días
  if (months < 0 || months > MAX_AGE_MONTHS) return undefined;
  return months;
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'El nombre es obligatorio';
  if (!form.laboratoryId) errors.laboratoryId = 'Seleccioná un laboratorio';
  if (form.species.length === 0) errors.species = 'Seleccioná al menos una especie';
  return errors;
}

const FIELD_CLASS = 'flex flex-col gap-1.5';

function FieldGroup({ label, required, error, children }: any) {
  return h(
    'div',
    { className: FIELD_CLASS },
    h(UI.Label, null, label, required && h('span', { className: 'text-cg-danger ml-0.5' }, '*')),
    children,
    error && h('span', { className: 'text-xs text-cg-danger' }, error)
  );
}

/** Chip "Completado desde SENASA" para marcar campos autorrellenados. */
function senaTag() {
  return h(
    UI.Badge,
    { variant: 'success-soft', size: 'sm', className: 'ml-2' } as any,
    h(UI.DynamicIcon, { icon: 'Check', size: 10 } as any),
    h('span', { className: 'ml-1' }, 'SENASA')
  );
}

export function VaccineFormDialog(props: VaccineFormDialogProps) {
  const { open, onClose, onSuccess, availableSpecies, defaultSpecies, vaccine, onSubmit } = props;

  const isEditing = !!vaccine;
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const savingChangeRef = useRef<((v: boolean) => void) | null>(null);
  // Producto elegido del vademécum (controla la tarjeta "seleccionado" del
  // buscador compartido) + modo carga manual. Solo aplica en alta.
  const [senaSelected, setSenaSelected] = useState<CatalogProductDetail | null>(null);
  const [senaCollapsed, setSenaCollapsed] = useState(false);

  useEffect(() => {
    savingChangeRef.current?.(saving);
  }, [saving]);

  useEffect(() => {
    if (open) {
      setForm(
        vaccine
          ? vaccineToForm(vaccine)
          : { ...INITIAL_FORM, species: defaultSpecies ? [defaultSpecies] : [] }
      );
      setTouched(new Set());
      setSenaSelected(null);
      setSenaCollapsed(false);
    }
  }, [open, vaccine, defaultSpecies]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;
  const fromSena = !!senaSelected;

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }, []);

  const touch = useCallback((key: string) => {
    setTouched((prev: Set<string>) => new Set(prev).add(key));
  }, []);

  const toggleSpecies = useCallback((sp: string) => {
    setForm((prev: FormState) => ({
      ...prev,
      species: prev.species.includes(sp)
        ? prev.species.filter((s: string) => s !== sp)
        : [...prev.species, sp],
    }));
  }, []);

  // ── Composición (agentes) ──
  const setAgent = (i: number, key: keyof AgentRow, val: string) =>
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)),
    }));
  const addAgent = () =>
    setForm((prev) => ({
      ...prev,
      components: [...prev.components, { agent: '', rawStrength: '' }],
    }));
  const removeAgent = (i: number) =>
    setForm((prev) => ({ ...prev, components: prev.components.filter((_, idx) => idx !== i) }));

  // Autofill: el buscador compartido ya resolvió la ficha completa; acá se mapea
  // el modelo común al form de vacuna. Además de los campos directos, se intenta
  // inferir el esquema de dosis del texto de indicaciones (best-effort).
  const handleSenaSelect = useCallback(
    async (detail: CatalogProductDetail) => {
      setSenaSelected(detail);
      const codes = [...new Set(detail.species.map(senasaSpeciesToCode))].filter((c) =>
        availableSpecies.includes(c)
      );
      const route = detail.administrationRoutes.length
        ? senasaRouteToEnum(detail.administrationRoutes)
        : null;
      const vtype = detectVaccineType(detail);
      const agents: AgentRow[] = detail.composition.map((c) => ({
        agent: c.substance,
        rawStrength: c.rawStrength ?? '',
        source: 'senasa',
      }));
      const sched = parseSchedule(detail.indications);
      const minAge = parseMinAge(detail.indications);
      setForm((prev) => ({
        ...prev,
        name: detail.commercialName || prev.name,
        species: codes.length ? codes : prev.species,
        administrationRoute: route ?? prev.administrationRoute,
        vaccineType: vtype ?? prev.vaccineType,
        senasaRegistration: detail.registrationNumber || prev.senasaRegistration,
        presentation: detail.presentation ?? prev.presentation,
        indications: detail.indications ?? prev.indications,
        senasaStatus: detail.status || prev.senasaStatus,
        components: agents.length ? agents : prev.components,
        minimumAgeMonths: minAge !== undefined ? String(minAge) : prev.minimumAgeMonths,
        scheduleDoses: sched.doses !== undefined ? String(sched.doses) : prev.scheduleDoses,
        scheduleIntervalDays:
          sched.intervalDays !== undefined ? String(sched.intervalDays) : prev.scheduleIntervalDays,
      }));
      // Laboratorio: upsert en el maestro compartido (COONG-219) y se referencia
      // por id. Si vademecum no responde, el vet lo elige manualmente.
      if (detail.laboratory) {
        try {
          const lab = await actions.execute<{ id: string }>('vademecum.laboratories.ensureByName', {
            name: detail.laboratory,
            taxId: detail.laboratoryTaxId,
            country: detail.country,
            source: 'senasa',
          });
          if (lab?.id) setForm((prev) => ({ ...prev, laboratoryId: lab.id }));
        } catch {
          /* el vet puede elegir el laboratorio manualmente */
        }
      }
    },
    [availableSpecies]
  );

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSubmit(formToData(form));
      onSuccess();
    } catch (err) {
      // El path de guardado (productos + detalle + agentes) no es atómico; si falla
      // a mitad hay que avisar (antes era silencioso) en vez de cerrar como si nada.
      hostToast(
        'Error',
        err instanceof Error ? err.message : 'No se pudo guardar la vacuna',
        'error'
      );
    } finally {
      setSaving(false);
    }
  }, [form, isValid, onSubmit, onSuccess]);

  // ── Render de una fila de agente ──
  function agentRow(c: AgentRow, i: number) {
    return h(
      'div',
      { key: i, className: 'flex items-center gap-2' },
      h(UI.Input, {
        value: c.agent,
        onChange: (e: any) => setAgent(i, 'agent', e.target.value),
        placeholder: 'Ej: Parvovirus canino',
        className: 'flex-1',
      } as any),
      h(UI.Input, {
        value: c.rawStrength,
        onChange: (e: any) => setAgent(i, 'rawStrength', e.target.value),
        placeholder: 'Título',
        className: 'w-28',
        size: 'sm',
      } as any),
      h(
        UI.Button,
        {
          type: 'button',
          variant: 'ghost',
          size: 'icon',
          title: 'Quitar agente',
          onClick: () => removeAgent(i),
        } as any,
        h(UI.DynamicIcon, { icon: 'X', size: 14 } as any)
      )
    );
  }

  return h(UI.FormDialogSubmit, {
    open,
    onOpenChange: (val: boolean) => !val && onClose(),
    title: isEditing ? 'Editar vacuna' : 'Agregar vacuna',
    size: 'lg',
    submitLabel: isEditing ? 'Guardar cambios' : 'Guardar vacuna',
    onCancel: onClose,
    disabled: !isValid || saving,
    children: ({ formRef, onSavingChange }: any) => {
      savingChangeRef.current = onSavingChange;
      return h(
        'form',
        {
          ref: formRef,
          onSubmit: (e: Event) => {
            e.preventDefault();
            void handleSubmit();
          },
          className: 'flex flex-col gap-4',
        },

        // === Buscador del vademécum (solo en alta) ===
        isEditing
          ? null
          : h(CatalogSearch, {
              kind: 'vaccine',
              selected: senaSelected,
              onSelect: (detail: CatalogProductDetail) => void handleSenaSelect(detail),
              onClear: () => setSenaSelected(null),
              collapsed: senaCollapsed,
              onCollapsedChange: setSenaCollapsed,
              title: 'Buscar en el vademécum de SENASA',
              subtitle:
                'Buscá la vacuna por nombre comercial y completamos los datos del producto.',
              placeholder: 'Buscar vacuna por nombre comercial...',
              itemIcon: 'Syringe',
            }),

        // === Identificación ===
        h(
          UI.FormSection,
          { icon: 'Tag', title: 'Identificación' } as any,
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              {
                label: 'Nombre comercial',
                required: true,
                error: touched.has('name') && errors.name,
              },
              h(UI.Input, {
                value: form.name,
                onChange: (e: any) => setField('name', e.target.value),
                onBlur: () => touch('name'),
                placeholder: 'Ej: Nobivac DHPPi+L4',
              } as any)
            ),
            h(
              FieldGroup,
              {
                label: 'Laboratorio',
                required: true,
                error: touched.has('laboratoryId') && errors.laboratoryId,
              },
              h(LaboratorySelect, {
                value: form.laboratoryId,
                onValueChange: (v: string) => {
                  setField('laboratoryId', v);
                  touch('laboratoryId');
                },
              })
            )
          ),
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              { label: h(React.Fragment, null, 'Registro SENASA', fromSena ? senaTag() : null) },
              h(UI.Input, {
                value: form.senasaRegistration,
                onChange: (e: any) => setField('senasaRegistration', e.target.value),
                placeholder: 'Ej: 00-022',
              } as any)
            ),
            h(
              FieldGroup,
              { label: h(React.Fragment, null, 'Presentación', fromSena ? senaTag() : null) },
              h(UI.Input, {
                value: form.presentation,
                onChange: (e: any) => setField('presentation', e.target.value),
                placeholder: 'Ej: Suspensión · 125 ml',
              } as any)
            )
          )
        ),

        // === Aplicación ===
        h(
          UI.FormSection,
          { icon: 'Syringe', title: 'Aplicación' } as any,
          h(
            FieldGroup,
            {
              label: 'Especies aplicables',
              required: true,
              error: touched.has('species') && errors.species,
            },
            h(
              'div',
              { className: 'flex gap-1.5 flex-wrap' },
              ...availableSpecies.map((sp) =>
                h(
                  UI.Chip,
                  {
                    key: sp,
                    variant: form.species.includes(sp) ? 'brand' : 'default',
                    onClick: () => {
                      toggleSpecies(sp);
                      touch('species');
                    },
                    className: 'cursor-pointer',
                  } as any,
                  formatSpecies(sp)
                )
              )
            )
          ),
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              { label: 'Tipo', required: true },
              h(
                UI.Select,
                {
                  value: form.vaccineType,
                  onValueChange: (v: string) => setField('vaccineType', v as VaccineType),
                  placeholder: 'Seleccionar tipo',
                  clearable: false,
                  debounceMs: 0,
                } as any,
                ...Object.entries(VACCINE_TYPE_LABELS).map(([val, label]) =>
                  h(UI.SelectItem, { key: val, value: val } as any, label)
                )
              )
            ),
            h(
              FieldGroup,
              { label: 'Vía de administración', required: true },
              h(
                UI.Select,
                {
                  value: form.administrationRoute,
                  onValueChange: (v: string) =>
                    setField('administrationRoute', v as AdministrationRoute),
                  placeholder: 'Seleccionar vía',
                  clearable: false,
                  debounceMs: 0,
                } as any,
                ...Object.entries(ADMINISTRATION_ROUTE_LABELS).map(([val, label]) =>
                  h(UI.SelectItem, { key: val, value: val } as any, label)
                )
              )
            )
          ),
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              { label: 'Edad mínima (meses)' },
              h(UI.Input, {
                type: 'number',
                min: 0,
                value: form.minimumAgeMonths,
                onChange: (e: any) => setField('minimumAgeMonths', e.target.value),
                placeholder: 'Ej: 2',
              } as any)
            ),
            h(
              FieldGroup,
              { label: 'Precio sugerido' },
              h(UI.Input, {
                type: 'number',
                min: 0,
                step: '100',
                value: form.suggestedPrice,
                onChange: (e: any) => setField('suggestedPrice', e.target.value),
                placeholder: 'Ej: 15000',
              } as any)
            )
          )
        ),

        // === Composición (agentes etiológicos / cepas) ===
        h(
          UI.FormSection,
          { icon: 'FlaskConical', title: 'Composición' } as any,
          h(
            'div',
            { className: 'flex flex-col gap-2' },
            h(
              'div',
              { className: 'flex items-center justify-between' },
              h(
                'span',
                { className: 'text-xs text-cg-text-muted' },
                'Agentes etiológicos / cepas que la vacuna inmuniza.'
              ),
              fromSena ? senaTag() : null
            ),
            ...form.components.map((c, i) => agentRow(c, i)),
            h(
              'button',
              {
                type: 'button',
                className:
                  'self-start text-xs text-cg-brand hover:underline inline-flex items-center gap-1',
                onClick: addAgent,
              },
              h(UI.DynamicIcon, { icon: 'Plus', size: 13 } as any),
              'Agregar agente'
            )
          )
        ),

        // === Esquema de dosis ===
        h(
          UI.FormSection,
          { icon: 'CalendarClock', title: 'Esquema de dosis' } as any,
          h(
            'div',
            { className: 'flex items-center gap-2 text-sm' },
            h(UI.Input, {
              type: 'number',
              min: 1,
              className: 'w-20',
              value: form.scheduleDoses,
              onChange: (e: any) => setField('scheduleDoses', e.target.value),
              placeholder: '3',
            } as any),
            h('span', { className: 'text-cg-text-muted' }, 'dosis · una cada'),
            h(UI.Input, {
              type: 'number',
              min: 1,
              className: 'w-20',
              value: form.scheduleIntervalDays,
              onChange: (e: any) => setField('scheduleIntervalDays', e.target.value),
              placeholder: '21',
            } as any),
            h('span', { className: 'text-cg-text-muted' }, 'días')
          ),
          // El esquema se infiere del texto libre de SENASA (best-effort): puede
          // venir incompleto o vacío. Se avisa para que el vet lo verifique contra
          // la pauta real (que queda visible en Indicaciones).
          fromSena
            ? h(
                'p',
                { className: 'text-xs text-cg-text-muted mt-2 flex items-center gap-1' },
                h(UI.DynamicIcon, { icon: 'Info', size: 12 } as any),
                'Sugerido desde el texto de SENASA — verificá la pauta en Indicaciones.'
              )
            : null
        ),

        // === Indicaciones ===
        h(
          UI.FormSection,
          { icon: 'ClipboardList', title: 'Indicaciones / uso' } as any,
          h(
            FieldGroup,
            { label: h(React.Fragment, null, 'Indicaciones', fromSena ? senaTag() : null) },
            h(UI.Textarea, {
              value: form.indications,
              onChange: (e: any) => setField('indications', e.target.value),
              placeholder: 'Enfermedades que previene, dosis y pauta de revacunación…',
              rows: 4,
            } as any)
          )
        ),

        // === Notas ===
        h(
          UI.FormSection,
          { icon: 'FileText', title: 'Notas' } as any,
          h(
            FieldGroup,
            { label: 'Notas' },
            h(UI.Textarea, {
              value: form.notes,
              onChange: (e: any) => setField('notes', e.target.value),
              placeholder: 'Ej: lote refrigerado, sensible a temperatura, etc.',
              rows: 3,
            } as any)
          )
        )
      );
    },
  });
}
