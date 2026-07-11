# @coongro/vaccination

## 0.2.0

### Minor Changes

- b881814: Carnet de la mascota: al hacer click en una fila de vacunas aplicadas se navega a "Aplicadas" filtrado por el paciente y su dueño (evita colisiones de nombre entre mascotas de distintos dueños). Se agrega el filtro por Dueño en la vista Aplicadas y se ajusta el ícono del módulo en la sección inyectada.
- ece7710: feat(catalog): show purchase cost + margin in the vaccine catalog (reading product.purchase_price), render species as icon chips matching Medicamentos, and drop the Estado/Tipo columns (COONG-223)
- d78d8f0: Autofill de alta de vacunas vía buscador del vademécum SENASA (COONG-224): el alta/edición de vacunas integra el buscador compartido (`@coongro/vademecum`) filtrando por vacunas, y autocompleta nombre, laboratorio, especies, vía, tipo, registro, presentación, indicaciones, vigencia y composición (agentes etiológicos/cepas). El esquema de dosis y la edad mínima se infieren best-effort del texto de SENASA (fail-safe y acotado, marcado como "sugerido"). Se agrega al modelo la tabla `vaccine_components` + columnas de registro/presentación/indicaciones/vigencia (migración 0004). El catálogo se consolida en `useVaccineCatalog` como fuente única (datos + CRUD), consumido por la vista; `uuid()` con fallback para contextos inseguros.
- 6d5e44e: feat: usar el maestro de laboratorios compartido (COONG-219)

  Vacunación deja de tener su propia tabla de laboratorios y pasa a consumir el
  maestro compartido de `@coongro/vademecum`:

  - Elimina `module_vaccination_laboratories` (migración de drop) y el repo
    `vaccination.laboratories`; `vaccine-detail.laboratory_id` ahora referencia el
    maestro.
  - El alta/edición de vacuna usa el `LaboratorySelect` compartido (con alta
    inline); la gestión de laboratorios se hace desde el menú "Laboratorios" de
    vademecum (se quita el drawer propio).
  - El seed siembra los laboratorios en el maestro vía `ensureByName`.

- cdf0f9c: feat: unificar los lotes de vacunas en products.batches y sacar la vista "Vacunación/Lotes" (COONG-220)

  Los lotes de vacunas dejan de modelarse como variantes de products (`attributes.kind='vaccination-batch'` + movimientos de stock) y pasan al motor unificado `products.batches`, igual que los medicamentos:

  - `applied_vaccination.variant_id` → `batch_id` (migración drizzle; sin datos en producción).
  - La aplicación de vacuna descuenta una dosis sobre el lote en `products.batches` (relee y marca el lote agotado al llegar a 0).
  - Los lotes con stock para aplicar se leen de `products.batches`.
  - Se elimina la vista "Vacunación/Lotes" y el modelo viejo de lotes por variante. Vacunación queda clínica (Vacunas, Aplicadas, Próximas dosis); la gestión de lotes vive ahora en Farmacia → Lotes (vista genérica de products).

### Patch Changes

- 60b431d: refactor(COONG-225 #8/#2): adopta uuid() y toast del plugin-sdk

  Elimina los workarounds que el SDK ahora resuelve de raíz:

  - `src/utils/uuid.ts` (uuid v4 con fallback `getRandomValues` para contexto
    inseguro) → `uuid` de `@coongro/plugin-sdk` (fuente única; misma lógica). Usado
    en `useVaccinationData` y `useVaccineCatalog`.
  - Los toast crudos (`window.coongro.toast.show`) en `VaccineFormDialog`,
    `useNextDoseScheduler`, y las vistas `aplicadas`/`catalogo` — que se hacían a
    mano porque `usePlugin().toast` requería contexto montado (crasheaba en plugins
    de Verdaccio) → `toast` standalone / `createToastApi(moduleId)` del SDK.

  Requiere `@coongro/plugin-sdk >=0.53.0`.

- 60b431d: refactor(COONG-225 #9): consume `speciesCodeFromText` de `@coongro/patients`

  Elimina el `senasaSpeciesToCode` duplicado en `VaccineFormDialog` y usa el
  normalizador compartido de la taxonomía de Pacientes (fuente única). Sin cambio
  de comportamiento. Requiere `@coongro/patients` con el export nuevo.

## 1.0.0

### Patch Changes

- @coongro/datetime@0.51.0
- @coongro/plugin-sdk@0.51.0
- @coongro/products@2.0.0
