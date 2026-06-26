---
'@coongro/vaccination': minor
---

feat: unificar los lotes de vacunas en products.batches y sacar la vista "Vacunación/Lotes" (COONG-220)

Los lotes de vacunas dejan de modelarse como variantes de products (`attributes.kind='vaccination-batch'` + movimientos de stock) y pasan al motor unificado `products.batches`, igual que los medicamentos:

- `applied_vaccination.variant_id` → `batch_id` (migración drizzle; sin datos en producción).
- La aplicación de vacuna descuenta una dosis sobre el lote en `products.batches` (relee y marca el lote agotado al llegar a 0).
- Los lotes con stock para aplicar se leen de `products.batches`.
- Se elimina la vista "Vacunación/Lotes" y el modelo viejo de lotes por variante. Vacunación queda clínica (Vacunas, Aplicadas, Próximas dosis); la gestión de lotes vive ahora en Farmacia → Lotes (vista genérica de products).
