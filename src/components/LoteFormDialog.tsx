import { getHostReact, getHostUI } from '@coongro/plugin-sdk';
import { DatePicker } from '@coongro/calendar';

const UI = getHostUI();

const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

/** Producto vacunal elegible para cargar un lote (del catálogo). */
export interface LoteProductOption {
  productId: string;
  name: string;
  labName: string;
}

export interface LoteFormData {
  productId: string;
  lote: string;
  expiresAt: string; // yyyy-mm-dd
  received: number;
  notes: string | null;
}

/** Lote existente para edición (subset de lo que muestra la vista). */
export interface LoteEditTarget {
  variantId: string;
  productId: string;
  lote: string;
  expiresAt: string;
  received: number;
  notes: string | null;
}

interface LoteFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: LoteProductOption[];
  /** Si viene, el dialog está en modo edición. */
  lote?: LoteEditTarget | null;
  onSubmit: (data: LoteFormData) => Promise<void>;
}

interface FormState {
  productId: string;
  lote: string;
  expiresAt: string;
  received: string;
  notes: string;
}

const INITIAL_FORM: FormState = {
  productId: '',
  lote: '',
  expiresAt: '',
  received: '',
  notes: '',
};

const FIELD_CLASS = 'flex flex-col gap-1.5';

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

/** Hoy a medianoche, para comparar contra el vencimiento sin desfase horario. */
function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function daysUntil(expiresAt: string): number | null {
  if (!expiresAt) return null;
  const [y, m, d] = expiresAt.split('-').map(Number);
  if (!y || !m || !d) return null;
  const exp = new Date(y, m - 1, d);
  return Math.round((exp.getTime() - todayMidnight().getTime()) / 86400000);
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.productId) errors.productId = 'Elegí el producto del catálogo.';
  if (!form.lote.trim()) errors.lote = 'El número de lote es obligatorio.';
  if (!form.expiresAt) errors.expiresAt = 'Ingresá la fecha de vencimiento.';
  const received = parseInt(form.received, 10);
  if (!form.received || isNaN(received) || received < 1)
    errors.received = 'Ingresá cuántas dosis recibiste.';
  return errors;
}

export function LoteFormDialog(props: LoteFormDialogProps) {
  const { open, onClose, onSuccess, products, lote, onSubmit } = props;

  const isEditing = !!lote;
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const savingChangeRef = useRef<((v: boolean) => void) | null>(null);

  useEffect(() => {
    savingChangeRef.current?.(saving);
  }, [saving]);

  useEffect(() => {
    if (open) {
      setForm(
        lote
          ? {
              productId: lote.productId,
              lote: lote.lote,
              expiresAt: lote.expiresAt,
              received: String(lote.received),
              notes: lote.notes ?? '',
            }
          : INITIAL_FORM
      );
      setTouched(new Set());
    }
  }, [open, lote]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }, []);

  const touch = useCallback((key: string) => {
    setTouched((prev: Set<string>) => new Set(prev).add(key));
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.productId === form.productId) ?? null,
    [products, form.productId]
  );

  // El lote ya vencido se puede cargar igual (queda con estado "Vencido"); solo avisamos.
  const expiredWarning = useMemo(() => {
    const days = daysUntil(form.expiresAt);
    return days !== null && days < 0;
  }, [form.expiresAt]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSubmit({
        productId: form.productId,
        lote: form.lote.trim(),
        expiresAt: form.expiresAt,
        received: parseInt(form.received, 10),
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
    title: isEditing ? 'Editar lote' : 'Cargar lote',
    eyebrow: isEditing ? 'EDITAR LOTE' : 'NUEVO LOTE',
    subtitle: isEditing
      ? 'Actualizá los datos del frasco.'
      : 'Registrá un frasco que recibís en la heladera.',
    size: 'md',
    submitLabel: isEditing ? 'Guardar cambios' : 'Guardar',
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

        // === Producto ===
        h(
          UI.FormSection,
          { icon: 'Syringe', title: 'Producto' } as any,
          // El laboratorio se infiere del producto seleccionado.
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
              : null,
          },
          isEditing
            ? // En edición no se cambia el producto (afectaría el catálogo/stock); solo lectura.
              h(UI.Input, {
                value: selectedProduct?.name ?? '',
                disabled: true,
              } as any)
            : h(
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
                  ...products.map((p) =>
                    h(UI.ComboboxItem, { key: p.productId, value: p.productId } as any, p.name)
                  )
                )
              )
          )
        ),

        // === Datos del lote ===
        h(
          UI.FormSection,
          { icon: 'Box', title: 'Datos del lote' } as any,
          h(
          FieldGroup,
          {
            label: 'Nro. de lote',
            required: true,
            error: touched.has('lote') && errors.lote,
          },
          h(UI.Input, {
            value: form.lote,
            onChange: (e: any) => setField('lote', e.target.value),
            onBlur: () => touch('lote'),
            placeholder: 'Ej: L2025C-00441',
            className: 'font-mono',
          } as any)
        ),

        h(
          'div',
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
          h(
            FieldGroup,
            {
              label: 'Fecha de vencimiento',
              required: true,
              error: touched.has('expiresAt') && errors.expiresAt,
              hint: expiredWarning ? null : 'Formato dd/mm/aaaa',
            },
            h(DatePicker, {
              value: form.expiresAt,
              onChange: (v: string) => {
                setField('expiresAt', v);
                touch('expiresAt');
              },
              placeholder: 'Seleccionar fecha',
            } as any)
          ),
          h(
            FieldGroup,
            {
              label: 'Dosis recibidas',
              required: true,
              error: touched.has('received') && errors.received,
            },
            h(UI.Input, {
              type: 'number',
              min: 1,
              value: form.received,
              onChange: (e: any) => setField('received', e.target.value),
              onBlur: () => touch('received'),
              placeholder: 'Ej: 25',
              disabled: isEditing,
            } as any)
          )
        ),

        // Aviso de lote vencido (no bloquea el guardado).
        expiredWarning &&
          h(
            'div',
            {
              className:
                'flex items-start gap-2 rounded-lg border border-cg-warning-border bg-cg-warning-bg px-3 py-2.5 text-xs text-cg-warning-text leading-relaxed',
            },
            h(UI.DynamicIcon, { icon: 'TriangleAlert', size: 14, className: 'mt-0.5 shrink-0' } as any),
            h(
              'span',
              null,
              h('strong', null, 'Este lote está vencido.'),
              ' Igual lo podés guardar — queda registrado con estado "Vencido" y no se usará al aplicar.'
            )
          ),

        isEditing &&
          h(
            'p',
            { className: 'text-xs text-cg-text-muted leading-relaxed' },
            'Las dosis recibidas no se editan acá para no descuadrar el stock. Para ajustar cantidades, dá de baja el lote y cargá uno nuevo.'
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
            placeholder: 'Opcional · ej: lote refrigerado, comprado en X distribuidora…',
            rows: 2,
          } as any)
          )
        )
      );
    },
  });
}
