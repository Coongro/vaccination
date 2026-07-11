import { DatePicker } from '@coongro/calendar';
import { PetPicker } from '@coongro/patients';
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';
import { BatchPicker } from '@coongro/products';
import { StaffPicker } from '@coongro/staff';

const UI = getHostUI();
import { daysUntil } from './date-utils.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

/** Vacuna del catálogo elegible para aplicar. */
export interface ApplyProductOption {
  productId: string;
  name: string;
  labName: string;
  /** Intervalo del esquema (días) para autocalcular la próxima dosis. */
  scheduleIntervalDays: number | null;
  /** Precio de venta del catálogo (para la línea de cobro al aplicar). */
  salePrice: string | null;
}

/** Lote disponible de un producto (fila de products.batches con stock). */
export interface ApplyLoteOption {
  batchId: string;
  lote: string;
  expiresAt: string;
  remaining: number;
}

export interface ApplyFormData {
  patientId: string;
  productId: string;
  batchId: string;
  appliedDate: string;
  weightKg: string | null;
  staffId: string | null;
  nextDoseDate: string | null;
  notes: string | null;
}

interface ApplyVaccineDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: ApplyProductOption[];
  /** Lotes disponibles por producto (id de producto → lotes con stock). */
  lotesByProduct: Record<string, ApplyLoteOption[]>;
  onSubmit: (data: ApplyFormData) => Promise<void>;
  /** Si viene, el paciente queda fijo (sin PetPicker) — alta desde la ficha. */
  fixedPatientId?: string;
  fixedPatientLabel?: string;
  /** Peso del paciente para pre-rellenar (último registrado). */
  fixedPatientWeight?: string;
}

interface FormState {
  patientId: string;
  productId: string;
  batchId: string;
  appliedDate: string;
  weightKg: string;
  staffId: string;
  nextDoseDate: string;
  notes: string;
}

const FIELD_CLASS = 'flex flex-col gap-1.5';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Suma días a una date-key yyyy-mm-dd y devuelve otra date-key. */
function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return '';
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + days);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function initialForm(): FormState {
  return {
    patientId: '',
    productId: '',
    batchId: '',
    appliedDate: todayKey(),
    weightKg: '',
    staffId: '',
    nextDoseDate: '',
    notes: '',
  };
}

function FieldGroup({ label, required, error, hint, children }: any) {
  return h(
    'div',
    { className: FIELD_CLASS },
    h(UI.Label, null, label, required && h('span', { className: 'text-cg-danger ml-0.5' }, '*')),
    children,
    error
      ? h('span', { className: 'text-xs text-cg-danger' }, error)
      : hint
        ? h('span', { className: 'text-xs text-cg-text-muted' }, hint)
        : null
  );
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.patientId) errors.patientId = 'Elegí el paciente.';
  if (!form.productId) errors.productId = 'Elegí un producto del catálogo.';
  if (!form.batchId) errors.batchId = 'Elegí el lote a aplicar.';
  if (!form.appliedDate) errors.appliedDate = 'Ingresá la fecha de aplicación.';
  if (!form.staffId) errors.staffId = 'Elegí el profesional que aplica.';
  return errors;
}

export function ApplyVaccineDialog(props: ApplyVaccineDialogProps) {
  const {
    open,
    onClose,
    onSuccess,
    products,
    lotesByProduct,
    onSubmit,
    fixedPatientId,
    fixedPatientLabel,
    fixedPatientWeight,
  } = props;

  const [form, setForm] = useState<FormState>(initialForm());
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const savingChangeRef = useRef<((v: boolean) => void) | null>(null);
  // El usuario editó la próxima dosis manualmente → no la recalculamos.
  const nextTouchedRef = useRef(false);

  useEffect(() => {
    savingChangeRef.current?.(saving);
  }, [saving]);

  useEffect(() => {
    if (open) {
      setForm({
        ...initialForm(),
        patientId: fixedPatientId ?? '',
        weightKg: fixedPatientWeight ?? '',
      });
      setTouched(new Set());
      nextTouchedRef.current = false;
    }
  }, [open, fixedPatientId, fixedPatientWeight]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }, []);

  const touch = useCallback((key: string) => {
    setTouched((prev: Set<string>) => new Set(prev).add(key));
  }, []);

  // Solo se puede aplicar un producto que tenga al menos un lote con stock.
  const productsWithLotes = useMemo(
    () => products.filter((p) => (lotesByProduct[p.productId]?.length ?? 0) > 0),
    [products, lotesByProduct]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.productId === form.productId) ?? null,
    [products, form.productId]
  );

  const availableLotes = useMemo(
    () => (form.productId ? (lotesByProduct[form.productId] ?? []) : []),
    [lotesByProduct, form.productId]
  );

  const selectedLote = useMemo(
    () => availableLotes.find((l) => l.batchId === form.batchId) ?? null,
    [availableLotes, form.batchId]
  );

  const loteExpired = useMemo(() => {
    if (!selectedLote) return false;
    const days = daysUntil(selectedLote.expiresAt);
    return days !== null && days < 0;
  }, [selectedLote]);

  // Autocalcular próxima dosis (fecha + intervalo del esquema) salvo edición manual.
  useEffect(() => {
    if (nextTouchedRef.current) return;
    const interval = selectedProduct?.scheduleIntervalDays;
    if (form.appliedDate && interval && interval > 0) {
      setForm((prev: FormState) => ({
        ...prev,
        nextDoseDate: addDays(prev.appliedDate, interval),
      }));
    }
  }, [form.appliedDate, selectedProduct]);

  // Al cambiar de producto, el lote elegido deja de ser válido.
  useEffect(() => {
    setForm((prev: FormState) => ({ ...prev, batchId: '' }));
  }, [form.productId]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSubmit({
        patientId: form.patientId,
        productId: form.productId,
        batchId: form.batchId,
        appliedDate: form.appliedDate,
        weightKg: form.weightKg.trim() || null,
        staffId: form.staffId || null,
        nextDoseDate: form.nextDoseDate || null,
        notes: form.notes.trim() || null,
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  }, [form, isValid, onSubmit, onSuccess]);

  return h(UI.FormDialogSubmit, {
    open,
    onOpenChange: (val: boolean) => !val && onClose(),
    title: 'Registrar aplicación',
    subtitle: 'La próxima dosis se calcula del esquema del catálogo y es editable.',
    size: 'lg',
    submitLabel: 'Guardar',
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

        // === Paciente ===
        h(
          UI.FormSection,
          { icon: 'PawPrint', title: 'Paciente' } as any,
          h(
            FieldGroup,
            {
              label: 'Paciente',
              required: true,
              error: touched.has('patientId') && errors.patientId,
            },
            fixedPatientId
              ? h(UI.Input, { value: fixedPatientLabel ?? 'Paciente', disabled: true } as any)
              : h(PetPicker, {
                  value: form.patientId || null,
                  onChange: (pet: { id?: string } | null) => {
                    setField('patientId', pet?.id ?? '');
                    touch('patientId');
                  },
                  placeholder: 'Buscar paciente…',
                } as any)
          )
        ),

        // === Vacuna ===
        h(
          UI.FormSection,
          { icon: 'Syringe', title: 'Vacuna' } as any,
          h(
            FieldGroup,
            {
              label: 'Producto',
              required: true,
              error: touched.has('productId') && errors.productId,
              hint: selectedProduct
                ? h(
                    'span',
                    null,
                    'Laboratorio: ',
                    h('strong', { className: 'text-cg-text' }, selectedProduct.labName || '—')
                  )
                : productsWithLotes.length === 0
                  ? 'No hay productos con lotes en stock. Cargá un lote en Lotes.'
                  : 'Solo se listan productos con lote disponible.',
            },
            h(
              UI.Combobox,
              {
                value: form.productId,
                onValueChange: (v: string) => {
                  setField('productId', v);
                  touch('productId');
                },
              } as any,
              h(UI.ComboboxChipTrigger, {
                placeholder: 'Buscar en el catálogo…',
                renderChip: (val: string, onRemove: () => void) => {
                  const p = products.find((x) => x.productId === val);
                  return h(UI.Chip, { size: 'sm', onRemove } as any, p?.name ?? val);
                },
              } as any),
              h(
                UI.ComboboxContent,
                null,
                ...productsWithLotes.map((p) =>
                  h(UI.ComboboxItem, { key: p.productId, value: p.productId } as any, p.name)
                )
              )
            )
          ),
          h(
            FieldGroup,
            {
              label: 'Lote',
              required: true,
              error: touched.has('batchId') && errors.batchId,
              hint: !form.productId
                ? 'Elegí primero un producto.'
                : availableLotes.length === 0
                  ? 'Este producto no tiene lotes con stock. Cargá uno en Lotes.'
                  : null,
            },
            h(BatchPicker, {
              batches: availableLotes.map((l) => ({
                id: l.batchId,
                batchNumber: l.lote,
                expirationDate: l.expiresAt,
                quantity: l.remaining,
              })),
              value: form.batchId,
              onChange: (v: string) => {
                setField('batchId', v);
                touch('batchId');
              },
              disabled: !form.productId || availableLotes.length === 0,
            })
          ),
          loteExpired &&
            h(
              'div',
              {
                className:
                  'flex items-start gap-2 rounded-lg border border-cg-warning-border bg-cg-warning-bg px-3 py-2.5 text-xs text-cg-warning-text leading-relaxed',
              },
              h(UI.DynamicIcon, {
                icon: 'TriangleAlert',
                size: 14,
                className: 'mt-0.5 shrink-0',
              } as any),
              h(
                'span',
                null,
                h('strong', null, 'Este lote está vencido.'),
                ' Podés registrarlo igual — queda asentado con la advertencia.'
              )
            )
        ),

        // === Aplicación ===
        h(
          UI.FormSection,
          { icon: 'CalendarClock', title: 'Aplicación' } as any,
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              {
                label: 'Fecha',
                required: true,
                error: touched.has('appliedDate') && errors.appliedDate,
              },
              h(DatePicker, {
                value: form.appliedDate,
                onChange: (v: string) => {
                  setField('appliedDate', v);
                  touch('appliedDate');
                },
                maxDate: todayKey(),
                placeholder: 'Seleccionar fecha',
              } as any)
            ),
            h(
              FieldGroup,
              { label: 'Peso (kg)' },
              h(UI.Input, {
                type: 'number',
                min: 0,
                step: '0.1',
                value: form.weightKg,
                onChange: (e: any) => setField('weightKg', e.target.value),
                placeholder: 'Ej: 29.8',
              } as any)
            )
          ),
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              {
                label: 'Profesional',
                required: true,
                error: touched.has('staffId') && errors.staffId,
              },
              h(StaffPicker, {
                value: form.staffId || null,
                onChange: (member: { id?: string } | null) => {
                  setField('staffId', member?.id ?? '');
                  touch('staffId');
                },
                placeholder: 'Buscar profesional…',
              } as any)
            ),
            h(
              FieldGroup,
              {
                label: 'Próxima dosis',
                hint: 'Calculada del esquema del catálogo. Editable.',
              },
              h(DatePicker, {
                value: form.nextDoseDate,
                onChange: (v: string) => {
                  nextTouchedRef.current = true;
                  setField('nextDoseDate', v);
                },
                placeholder: 'Sin próxima dosis',
              } as any)
            )
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
              placeholder: 'Opcional · reacciones, indicaciones para el dueño…',
              rows: 2,
            } as any)
          )
        )
      );
    },
  });
}