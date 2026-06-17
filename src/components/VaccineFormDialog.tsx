import { formatSpecies } from '@coongro/patients';
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import type { VaccineCatalogItem, CreateVaccineData } from '../hooks/useVaccineCatalog.js';
import type { LaboratoryRow } from '../schema/laboratory.js';
import type { VaccineType, AdministrationRoute } from '../types/vaccination.js';
import { VACCINE_TYPE_LABELS, ADMINISTRATION_ROUTE_LABELS } from '../types/vaccination.js';

import { AddLabDialog } from './AddLabDialog.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

interface VaccineFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratories: LaboratoryRow[];
  availableSpecies: string[];
  defaultSpecies?: string;
  vaccine?: VaccineCatalogItem | null;
  onSubmit: (data: CreateVaccineData) => Promise<void>;
  onCreateLaboratory?: (name: string) => Promise<LaboratoryRow>;
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
  };
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

export function VaccineFormDialog(props: VaccineFormDialogProps) {
  const {
    open,
    onClose,
    onSuccess,
    laboratories,
    availableSpecies,
    defaultSpecies,
    vaccine,
    onSubmit,
    onCreateLaboratory,
  } = props;

  const isEditing = !!vaccine;
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [createLabName, setCreateLabName] = useState<string | null>(null);
  const [savingLab, setSavingLab] = useState(false);
  const savingChangeRef = useRef<((v: boolean) => void) | null>(null);

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
      setCreateLabName(null);
    }
  }, [open, vaccine, defaultSpecies]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

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

  const handleSaveNewLab = useCallback(
    async (name: string) => {
      if (!name.trim() || !onCreateLaboratory) return;
      setSavingLab(true);
      try {
        const lab = await onCreateLaboratory(name.trim());
        setField('laboratoryId', lab.id);
        setCreateLabName(null);
      } finally {
        setSavingLab(false);
      }
    },
    [onCreateLaboratory, setField]
  );

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSubmit(formToData(form));
      onSuccess();
    } finally {
      setSaving(false);
    }
  }, [form, isValid, onSubmit, onSuccess]);

  return h(
    React.Fragment,
    null,
    h(UI.FormDialogSubmit, {
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
                h(
                  UI.Combobox,
                  {
                    value: form.laboratoryId,
                    onValueChange: (v: string) => {
                      setField('laboratoryId', v);
                      touch('laboratoryId');
                    },
                  } as any,
                  h(UI.ComboboxChipTrigger, {
                    placeholder: 'Seleccionar laboratorio',
                    renderChip: (val: string, onRemove: () => void) => {
                      const lab = laboratories.find((l) => l.id === val);
                      return h(UI.Chip, { size: 'sm', onRemove } as any, lab?.name ?? val);
                    },
                  } as any),
                  h(
                    UI.ComboboxContent,
                    null,
                    ...laboratories
                      .filter((lab) => lab.is_active)
                      .map((lab) =>
                        h(UI.ComboboxItem, { key: lab.id, value: lab.id } as any, lab.name)
                      ),
                    onCreateLaboratory &&
                      h(UI.ComboboxCreate, {
                        label: 'Crear "{search}"',
                        onCreate: (searchVal: string) => setCreateLabName(searchVal),
                      } as any)
                  )
                )
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
    }),

    h(AddLabDialog, {
      open: createLabName !== null,
      onClose: () => setCreateLabName(null),
      onSave: async (name: string) => {
        await handleSaveNewLab(name);
      },
      initialName: createLabName ?? '',
      existingNames: laboratories.map((l) => l.name),
      saving: savingLab,
    })
  );
}
