import { getHostReact, getHostUI, views } from '@coongro/plugin-sdk';

const UI = getHostUI();
import { computeBatchStatus, statusBadge, formatDate } from './lote-status.js';
import type { BatchItem } from './lote-status.js';

const React = getHostReact();
const { useState, useCallback } = React;
const h = React.createElement;

interface LoteDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  lote: BatchItem | null;
  onEdit: () => void;
  onBaja: (variantId: string) => Promise<void>;
}

export function LoteDetailDrawer(props: LoteDetailDrawerProps) {
  const { open, onClose, lote, onEdit, onBaja } = props;
  const [confirmingBaja, setConfirmingBaja] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBaja = useCallback(async () => {
    if (!lote) return;
    setProcessing(true);
    try {
      await onBaja(lote.variantId);
      setConfirmingBaja(false);
      onClose();
    } finally {
      setProcessing(false);
    }
  }, [lote, onBaja, onClose]);

  if (!lote) return null;

  const status = computeBatchStatus(lote);
  const mono = { fontFamily: 'var(--cg-font-mono, SF Mono, Menlo, monospace)' };

  const detailRows: [string, unknown][] = [
    ['Nro. de lote', h('span', { style: { ...mono, fontWeight: 700 } }, lote.lote)],
    ['Vencimiento', h('span', { style: mono }, formatDate(lote.expiresAt))],
    ['Estado', statusBadge(status)],
    ['Dosis recibidas', h('span', { style: mono }, String(lote.received))],
    ['Dosis aplicadas', h('span', { style: mono }, String(lote.applied))],
    ['Dosis restantes', h('span', { style: { ...mono, fontWeight: 700 } }, String(lote.remaining))],
    [
      'Notas',
      lote.notes
        ? h('span', null, lote.notes)
        : h('span', { style: { color: 'var(--cg-text-muted)' } }, '—'),
    ],
  ];

  return h(
    React.Fragment,
    null,
    h(
      UI.Sheet,
      { open, onOpenChange: (val: boolean) => !val && onClose(), side: 'right' } as any,
      h(
        UI.SheetContent,
        {
          style: { width: '480px', maxWidth: '92vw', display: 'flex', flexDirection: 'column' },
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
              'DETALLE DEL LOTE'
            ),
            h(UI.SheetTitle, null, lote.productName),
            h(
              'p',
              { style: { fontSize: '12.5px', color: 'var(--cg-text-muted)', margin: '4px 0 0' } },
              lote.labName || '—'
            )
          )
        ),

        // Body
        h(
          'div',
          { style: { flex: 1, overflow: 'auto', padding: '20px 24px' } },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', marginBottom: '24px' } },
            ...detailRows.map(([label, value], i) =>
              h(
                'div',
                {
                  key: label,
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '11px 0',
                    borderBottom: i < detailRows.length - 1 ? '1px solid var(--cg-border)' : 'none',
                    fontSize: '13px',
                  },
                },
                h('span', { style: { color: 'var(--cg-text-muted)' } }, label),
                h(
                  'span',
                  { style: { color: 'var(--cg-text)', textAlign: 'right' } },
                  value as never
                )
              )
            )
          )
        ),

        // Zona de peligro: pinneada abajo del todo (solo si el lote está activo)
        lote.isActive &&
          h(
            'div',
            {
              style: {
                flexShrink: 0,
                padding: '16px 24px',
                borderTop: '1px dashed var(--cg-border)',
              },
            },
            h(
              'div',
              {
                style: {
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--cg-danger)',
                  marginBottom: '10px',
                },
              },
              'Zona de peligro'
            ),
            h(
              UI.Button,
              {
                variant: 'destructive',
                style: { width: '100%' },
                onClick: () => setConfirmingBaja(true),
              } as any,
              h(UI.DynamicIcon, { icon: 'Archive', size: 13 } as any),
              ' Dar de baja el lote'
            ),
            h(
              'p',
              {
                style: {
                  fontSize: '11.5px',
                  color: 'var(--cg-text-muted)',
                  margin: '8px 0 0',
                  lineHeight: 1.5,
                },
              },
              'Usalo si el frasco se rompió, se perdió la cadena de frío o querés retirarlo. El lote no se borra — queda marcado como dado de baja en el histórico.'
            )
          ),

        // Footer — Cerrar + Editar (brand), mismo patrón que el ProductDetailDrawer del Catálogo
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
            UI.Button,
            {
              variant: 'outline',
              onClick: () => views.open('vaccination.aplicadas.open', { lote: lote.lote }),
            } as any,
            h(UI.DynamicIcon, { icon: 'ExternalLink', size: 13 } as any),
            ' Ver aplicaciones'
          ),
          h('span', { style: { flex: 1 } }),
          h(UI.Button, { variant: 'outline', onClick: onClose } as any, 'Cerrar'),
          h(UI.Button, { variant: 'brand', onClick: onEdit } as any, 'Editar')
        )
      )
    ),

    // Confirmación de baja
    h(UI.ConfirmDialog, {
      open: confirmingBaja,
      onOpenChange: (val: boolean) => !val && setConfirmingBaja(false),
      title: 'Dar de baja el lote',
      description: h(
        React.Fragment,
        null,
        '¿Dar de baja el lote ',
        h('strong', null, lote.lote),
        '? El lote no se borra — queda registrado como dado de baja. No vas a poder aplicar más dosis de este frasco.'
      ),
      confirmLabel: 'Sí, dar de baja',
      loadingLabel: 'Procesando...',
      loading: processing,
      onConfirm: () => void handleBaja(),
    } as any)
  );
}
