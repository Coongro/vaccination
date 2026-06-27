import { formatSpecies } from '@coongro/patients';
import { getHostReact, getHostUI, views } from '@coongro/plugin-sdk';
import { StockPanel } from '@coongro/products';

import type { VaccineCatalogItem } from '../hooks/useVaccineCatalog.js';
import { VACCINE_TYPE_LABELS, ADMINISTRATION_ROUTE_LABELS } from '../types/vaccination.js';

const UI = getHostUI();
const React = getHostReact();
const h = React.createElement;

interface ProductDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  vaccine: VaccineCatalogItem | null;
  laboratoryName: string;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function ProductDetailDrawer(props: ProductDetailDrawerProps) {
  const { open, onClose, vaccine, laboratoryName, onEdit, onToggleActive } = props;

  if (!vaccine) return null;

  const SENASA_STATUS_LABEL: Record<string, string> = {
    active: 'Vigente',
    discontinued: 'Dado de baja',
    unknown: '—',
  };

  const detailRows: [string, any][] = [
    ['Nombre comercial', vaccine.name],
    ['Laboratorio', laboratoryName],
    ['Registro SENASA', vaccine.senasaRegistration || '—'],
    ['Presentación', vaccine.presentation || '—'],
    ['Especies', vaccine.species.map((s) => formatSpecies(s)).join(', ')],
    ['Tipo', VACCINE_TYPE_LABELS[vaccine.vaccineType]],
    ['Vía', ADMINISTRATION_ROUTE_LABELS[vaccine.administrationRoute]],
    ['Edad mínima', vaccine.minimumAgeMonths !== null ? `${vaccine.minimumAgeMonths} meses` : '—'],
    [
      'Esquema',
      vaccine.scheduleDoses
        ? `${vaccine.scheduleDoses} dosis${vaccine.scheduleIntervalDays ? ' · cada ' + vaccine.scheduleIntervalDays + ' días' : ''}`
        : '—',
    ],
    [
      'Precio sugerido',
      vaccine.suggestedPrice ? `$${Number(vaccine.suggestedPrice).toLocaleString('es-AR')}` : '—',
    ],
    [
      'Vigencia SENASA',
      vaccine.senasaStatus
        ? (SENASA_STATUS_LABEL[vaccine.senasaStatus] ?? vaccine.senasaStatus)
        : '—',
    ],
    ['Notas', vaccine.notes || '—'],
  ];

  // Título de sección reutilizable (mismo estilo que "DETALLE").
  const sectionTitle = (text: string) =>
    h(
      'h3',
      {
        style: {
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--cg-text-muted)',
          margin: '20px 0 8px',
        },
      },
      text
    );

  return h(
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
            laboratoryName.toUpperCase()
          ),
          h(UI.SheetTitle, null, vaccine.name),
          h(
            'div',
            { style: { marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            h(
              UI.Badge,
              { variant: vaccine.vaccineType === 'rabies' ? 'warning' : 'default' } as any,
              VACCINE_TYPE_LABELS[vaccine.vaccineType]
            ),
            ...vaccine.species.map((sp) =>
              h(UI.Badge, { key: sp, variant: 'secondary' } as any, formatSpecies(sp))
            ),
            h(
              UI.Badge,
              { variant: vaccine.isActive ? 'success' : 'secondary' } as any,
              vaccine.isActive ? 'Activo' : 'Inactivo'
            )
          )
        )
      ),

      // Body
      h(
        'div',
        { style: { flex: 1, overflow: 'auto', padding: '20px 24px' } },

        h(
          'h3',
          {
            style: {
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--cg-text-muted)',
              marginBottom: '8px',
            },
          },
          'DETALLE'
        ),

        ...detailRows.map(([label, value], i) =>
          h(
            'div',
            {
              key: label,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '10px 0',
                borderBottom: i < detailRows.length - 1 ? '1px solid var(--cg-border)' : 'none',
                fontSize: '13px',
              },
            },
            h('span', { style: { color: 'var(--cg-text-muted)' } }, label),
            h('span', { style: { color: 'var(--cg-text)', textAlign: 'right' } }, value)
          )
        ),

        // Composición (agentes etiológicos / cepas)
        vaccine.components.length > 0
          ? h(
              'div',
              null,
              sectionTitle('Composición'),
              ...vaccine.components.map((c, i) =>
                h(
                  'div',
                  {
                    key: i,
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '16px',
                      padding: '8px 0',
                      borderBottom:
                        i < vaccine.components.length - 1 ? '1px solid var(--cg-border)' : 'none',
                      fontSize: '13px',
                    },
                  },
                  h('span', { style: { color: 'var(--cg-text)' } }, c.agent),
                  c.rawStrength
                    ? h(
                        'span',
                        { style: { color: 'var(--cg-text-muted)', textAlign: 'right' } },
                        c.rawStrength
                      )
                    : null
                )
              )
            )
          : null,

        // Indicaciones / uso (texto del fabricante)
        vaccine.indications
          ? h(
              'div',
              null,
              sectionTitle('Indicaciones / uso'),
              h(
                'p',
                {
                  style: {
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'var(--cg-text)',
                    whiteSpace: 'pre-line',
                  },
                },
                vaccine.indications
              )
            )
          : null,

        // Stock / Lotes de esta vacuna (read-only; la gestión vive en Lotes y stock).
        h(
          'div',
          { style: { marginTop: '20px' } },
          h(StockPanel, {
            productId: vaccine.productId,
            unit: 'dosis',
            onGestionar: () =>
              views.open('kit-veterinary.lotes.open', { productId: vaccine.productId }),
          } as any)
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
            gap: '8px',
            alignItems: 'center',
          },
        },
        h(
          UI.Button,
          { variant: 'outline', onClick: onToggleActive } as any,
          vaccine.isActive ? 'Desactivar' : 'Activar'
        ),
        h(
          UI.Button,
          {
            variant: 'outline',
            onClick: () =>
              views.open('vaccination.aplicadas.open', { productId: vaccine.productId }),
          } as any,
          h(UI.DynamicIcon, { icon: 'ExternalLink', size: 13 } as any),
          ' Ver aplicadas'
        ),
        h('span', { style: { flex: 1 } }),
        h(UI.Button, { variant: 'outline', onClick: onClose } as any, 'Cerrar'),
        h(UI.Button, { variant: 'brand', onClick: onEdit } as any, 'Editar')
      )
    )
  );
}
