import { actions } from '@coongro/plugin-sdk';

/** Datos para cobrar una vacuna aplicada. */
export interface ChargeVaccineParams {
  appliedId: string;
  productId: string;
  productName: string;
  /** Precio del catálogo (sale_price). Si es null se cobra 0 (editable después en Cobros). */
  salePrice: string | null;
  contactId: string | null;
  petId: string;
  /** Si la vacuna se aplicó dentro de una consulta, su id (cuenta de esa visita). */
  consultationId?: string | null;
}

/**
 * Empuja la línea de cobro de una vacuna aplicada a su "cuenta de atención" (@coongro/billing):
 * - con `consultationId` → línea sobre la cuenta de esa consulta.
 * - sin consulta → abre una venta de mostrador con la línea.
 * Idempotente por `appliedId` (billing.lines.add no duplica por source_ref).
 *
 * Dependencia BLANDA: si billing no está instalado, no rompe — la aplicación clínica
 * ya quedó registrada; simplemente no se genera el cobro.
 */
export async function chargeAppliedVaccine(p: ChargeVaccineParams): Promise<void> {
  if (!p.petId) return;
  try {
    const account = await actions.execute<{ id: string } | undefined>(
      'billing.accounts.openForVisit',
      {
        contactId: p.contactId ?? null,
        petId: p.petId,
        consultationId: p.consultationId ?? null,
      }
    );
    if (!account?.id) return;
    await actions.execute('billing.lines.add', {
      accountId: account.id,
      productId: p.productId,
      description: p.productName,
      quantity: '1',
      unitPrice: p.salePrice ?? '0',
      sourceType: 'vaccine',
      sourceRef: p.appliedId,
    });
  } catch {
    /* billing no disponible — la dosis igual quedó aplicada/registrada */
  }
}
