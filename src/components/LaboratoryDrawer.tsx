import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

const UI = getHostUI();
import type { LaboratoryRow } from '../schema/laboratory.js';

import { AddLabDialog } from './AddLabDialog.js';

const React = getHostReact();
const { useState, useCallback, useEffect } = React;
const h = React.createElement;

interface LaboratoryDrawerProps {
  open: boolean;
  onClose: () => void;
  laboratories: LaboratoryRow[];
  /** Cantidad de productos del catálogo que referencian cada laboratorio (por id). */
  productCounts?: Record<string, number>;
  onCreate: (data: { name: string }) => Promise<LaboratoryRow>;
  onUpdate: (id: string, data: Partial<LaboratoryRow>) => Promise<LaboratoryRow>;
  onRemove: (id: string) => Promise<void>;
}

export function LaboratoryDrawer(props: LaboratoryDrawerProps) {
  const { open, onClose, laboratories, onCreate, onUpdate, onRemove, productCounts = {} } = props;
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [savingLab, setSavingLab] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Limpiar una confirmación de borrado pendiente al cerrar el drawer.
  useEffect(() => {
    if (!open) setConfirmingId(null);
  }, [open]);

  const labToDelete = laboratories.find((l) => l.id === confirmingId) ?? null;

  const handleSaveNewLab = useCallback(
    async (name: string) => {
      setSavingLab(true);
      try {
        await onCreate({ name });
        setShowAddDialog(false);
      } finally {
        setSavingLab(false);
      }
    },
    [onCreate]
  );

  const handleSaveEdit = useCallback(
    async (id: string) => {
      if (!editingName.trim()) return;
      await onUpdate(id, { name: editingName.trim() });
      setEditingId(null);
    },
    [editingName, onUpdate]
  );

  const handleToggleActive = useCallback(
    async (lab: LaboratoryRow) => {
      await onUpdate(lab.id, { is_active: !lab.is_active });
    },
    [onUpdate]
  );

  const handleRemove = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        await onRemove(id);
        setConfirmingId(null);
      } finally {
        setDeleting(false);
      }
    },
    [onRemove]
  );

  return h(
    React.Fragment,
    null,
    h(
      UI.Sheet,
      { open, onOpenChange: (val: boolean) => !val && onClose(), side: 'right' } as any,
      h(
        UI.SheetContent,
        {
          style: { width: '520px', maxWidth: '92vw', display: 'flex', flexDirection: 'column' },
        } as any,

        // Header
        h(
          UI.SheetHeader,
          null,
          h(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            h(
              'div',
              {
                style: {
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--cg-text-muted)',
                  marginBottom: '4px',
                },
              },
              'CATÁLOGO · LABORATORIOS'
            ),
            h(UI.SheetTitle, null, 'Laboratorios'),
            h(
              'p',
              { style: { fontSize: '12.5px', color: 'var(--cg-text-muted)', margin: '4px 0 0' } },
              'Los proveedores de los productos vacunales del tenant.'
            )
          )
        ),

        // Create bar
        h(
          'div',
          {
            style: {
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--cg-border)',
            },
          },
          h(
            'span',
            { style: { fontSize: '12.5px', color: 'var(--cg-text-muted)' } },
            h('strong', { style: { color: 'var(--cg-text)' } }, String(laboratories.length)),
            ' laboratorios'
          ),
          h(
            UI.Button,
            {
              variant: 'brand',
              size: 'sm',
              onClick: () => setShowAddDialog(true),
            } as any,
            h(UI.DynamicIcon, { icon: 'Plus', size: 12 } as any),
            ' Agregar laboratorio'
          )
        ),

        // List
        h(
          'div',
          { style: { flex: 1, overflow: 'auto' } },
          laboratories.length === 0
            ? h(UI.EmptyState, {
                title: 'Sin laboratorios',
                description: 'Agregá el primer laboratorio para empezar.',
              } as any)
            : laboratories.map((lab, i) =>
                h(
                  'div',
                  {
                    key: lab.id,
                    style: {
                      padding: '14px 24px',
                      borderBottom:
                        i < laboratories.length - 1 ? '1px solid var(--cg-border)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    },
                  },
                  editingId === lab.id
                    ? h(
                        React.Fragment,
                        null,
                        h(UI.Input, {
                          style: { flex: 1 },
                          size: 'sm',
                          value: editingName,
                          onChange: (e: any) => setEditingName(e.target.value),
                          onKeyDown: (e: any) => e.key === 'Enter' && handleSaveEdit(lab.id),
                          autoFocus: true,
                        } as any),
                        h(
                          UI.Button,
                          {
                            variant: 'brand',
                            size: 'sm',
                            onClick: () => handleSaveEdit(lab.id),
                          } as any,
                          'OK'
                        ),
                        h(
                          UI.Button,
                          {
                            variant: 'ghost',
                            size: 'sm',
                            onClick: () => setEditingId(null),
                          } as any,
                          'X'
                        )
                      )
                    : h(
                        React.Fragment,
                        null,
                        h(
                          'div',
                          { style: { flex: 1 } },
                          h(
                            'div',
                            {
                              style: {
                                fontWeight: 700,
                                fontSize: '14px',
                                color: lab.is_active ? 'var(--cg-text)' : 'var(--cg-text-muted)',
                              },
                            },
                            lab.name
                          ),
                          h(
                            'div',
                            {
                              style: {
                                fontSize: '12px',
                                color: 'var(--cg-text-muted)',
                                marginTop: '2px',
                              },
                            },
                            `${productCounts[lab.id] ?? 0} ${
                              (productCounts[lab.id] ?? 0) === 1 ? 'producto' : 'productos'
                            }`
                          )
                        ),
                        h(
                          UI.Badge,
                          { variant: lab.is_active ? 'success' : 'secondary' } as any,
                          lab.is_active ? 'Activo' : 'Inactivo'
                        ),
                        h(
                          UI.IconButton,
                          {
                            variant: 'ghost',
                            size: 'sm',
                            'aria-label': `Editar laboratorio ${lab.name}`,
                            onClick: () => {
                              setEditingId(lab.id);
                              setEditingName(lab.name);
                            },
                          } as any,
                          h(UI.DynamicIcon, { icon: 'Pencil', size: 14 } as any)
                        ),
                        h(
                          UI.IconButton,
                          {
                            variant: 'ghost',
                            size: 'sm',
                            'aria-label': `${
                              lab.is_active ? 'Desactivar' : 'Activar'
                            } laboratorio ${lab.name}`,
                            onClick: () => handleToggleActive(lab),
                          } as any,
                          h(UI.DynamicIcon, {
                            icon: lab.is_active ? 'Archive' : 'ArchiveRestore',
                            size: 14,
                          } as any)
                        ),
                        // Solo se puede eliminar un laboratorio sin productos asociados
                        // (ej. uno creado por error). Si tiene productos, se desactiva.
                        (productCounts[lab.id] ?? 0) > 0
                          ? h(
                              UI.IconButton,
                              {
                                variant: 'ghost',
                                size: 'sm',
                                disabled: true,
                                title: `No se puede eliminar: tiene ${productCounts[lab.id]} ${
                                  productCounts[lab.id] === 1
                                    ? 'producto asociado'
                                    : 'productos asociados'
                                }. Desactivalo en su lugar.`,
                                'aria-label': `Eliminar laboratorio ${lab.name} (deshabilitado: en uso)`,
                              } as any,
                              h(UI.DynamicIcon, { icon: 'Trash2', size: 14 } as any)
                            )
                          : h(
                              UI.IconButton,
                              {
                                variant: 'ghost',
                                size: 'sm',
                                'aria-label': `Eliminar laboratorio ${lab.name}`,
                                onClick: () => setConfirmingId(lab.id),
                              } as any,
                              h(UI.DynamicIcon, {
                                icon: 'Trash2',
                                size: 14,
                                color: 'var(--cg-danger)',
                              } as any)
                            )
                      )
                )
              )
        ),

        // Footer
        h(
          'div',
          {
            style: {
              padding: '16px 24px',
              borderTop: '1px solid var(--cg-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            },
          },
          h(
            'span',
            { style: { fontSize: '11.5px', color: 'var(--cg-text-muted)', flex: 1 } },
            'Desactivar un laboratorio oculta sus productos del catálogo activo.'
          ),
          h(UI.Button, { variant: 'outline', onClick: onClose } as any, 'Cerrar')
        )
      )
    ),

    // AddLabDialog stackeado sobre el drawer
    h(AddLabDialog, {
      open: showAddDialog,
      onClose: () => setShowAddDialog(false),
      onSave: handleSaveNewLab,
      existingNames: laboratories.map((l) => l.name),
      saving: savingLab,
    }),

    // Confirmación de borrado (dialog modal)
    h(UI.ConfirmDialog, {
      open: confirmingId !== null,
      onOpenChange: (val: boolean) => !val && setConfirmingId(null),
      title: 'Eliminar laboratorio',
      description: labToDelete
        ? h(
            React.Fragment,
            null,
            '¿Seguro que querés eliminar el laboratorio ',
            h('strong', null, labToDelete.name),
            '? Esta acción no se puede deshacer.'
          )
        : '',
      confirmLabel: 'Eliminar',
      loadingLabel: 'Eliminando...',
      loading: deleting,
      onConfirm: () => confirmingId && void handleRemove(confirmingId),
    } as any)
  );
}
