import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

const UI = getHostUI();

const React = getHostReact();
const { useState, useEffect, useMemo } = React;
const h = React.createElement;

interface AddLabDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  initialName?: string;
  existingNames: string[];
  saving?: boolean;
}

export function AddLabDialog(props: AddLabDialogProps) {
  const { open, onClose, onSave, initialName = '', existingNames, saving = false } = props;

  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const duplicateError = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return null;
    return existingNames.some((n) => n.toLowerCase() === trimmed)
      ? 'Ya existe un laboratorio con ese nombre en el tenant.'
      : null;
  }, [name, existingNames]);

  const isValid = name.trim().length > 0 && !duplicateError;

  return h(UI.FormDialogSubmit, {
    open,
    onOpenChange: (val: boolean) => !val && onClose(),
    title: 'Agregar laboratorio',
    eyebrow: 'NUEVO LABORATORIO',
    size: 'sm',
    submitLabel: saving ? 'Guardando...' : 'Guardar',
    onCancel: onClose,
    disabled: !isValid || saving,
    children: ({ formRef }: any) =>
      h(
        'form',
        {
          ref: formRef,
          onSubmit: (e: Event) => {
            e.preventDefault();
            if (isValid) void onSave(name.trim());
          },
          style: { display: 'flex', flexDirection: 'column', gap: '12px' },
        },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          h(
            UI.Label,
            null,
            'Nombre del laboratorio',
            h('span', { style: { color: 'var(--cg-danger)', marginLeft: '2px' } }, '*')
          ),
          h(UI.Input, {
            value: name,
            onChange: (e: any) => setName(e.target.value),
            placeholder: 'Ej: Vetanco, Biogénesis Bagó…',
            autoFocus: true,
          } as any),
          duplicateError &&
            h(
              'span',
              { style: { fontSize: '12px', color: 'var(--cg-danger)' } },
              duplicateError
            )
        ),
        h(
          'p',
          {
            style: {
              fontSize: '11.5px',
              color: 'var(--cg-text-muted)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            },
          },
          'El laboratorio se crea activo. Para desactivarlo después, abrí ',
          h('em', null, 'Gestionar laboratorios'),
          '.'
        )
      ),
  });
}
