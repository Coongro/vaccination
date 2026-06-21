---
"@coongro/vaccination": minor
---

feat: usar el maestro de laboratorios compartido (COONG-219)

Vacunación deja de tener su propia tabla de laboratorios y pasa a consumir el
maestro compartido de `@coongro/vademecum`:

- Elimina `module_vaccination_laboratories` (migración de drop) y el repo
  `vaccination.laboratories`; `vaccine-detail.laboratory_id` ahora referencia el
  maestro.
- El alta/edición de vacuna usa el `LaboratorySelect` compartido (con alta
  inline); la gestión de laboratorios se hace desde el menú "Laboratorios" de
  vademecum (se quita el drawer propio).
- El seed siembra los laboratorios en el maestro vía `ensureByName`.
