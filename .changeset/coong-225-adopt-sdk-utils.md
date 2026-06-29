---
'@coongro/vaccination': patch
---

refactor(COONG-225 #8/#2): adopta uuid() y toast del plugin-sdk

Elimina los workarounds que el SDK ahora resuelve de raíz:

- `src/utils/uuid.ts` (uuid v4 con fallback `getRandomValues` para contexto
  inseguro) → `uuid` de `@coongro/plugin-sdk` (fuente única; misma lógica). Usado
  en `useVaccinationData` y `useVaccineCatalog`.
- Los toast crudos (`window.coongro.toast.show`) en `VaccineFormDialog`,
  `useNextDoseScheduler`, y las vistas `aplicadas`/`catalogo` — que se hacían a
  mano porque `usePlugin().toast` requería contexto montado (crasheaba en plugins
  de Verdaccio) → `toast` standalone / `createToastApi(moduleId)` del SDK.

Requiere `@coongro/plugin-sdk >=0.53.0`.
