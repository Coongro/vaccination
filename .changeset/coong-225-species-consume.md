---
'@coongro/vaccination': patch
---

refactor(COONG-225 #9): consume `speciesCodeFromText` de `@coongro/patients`

Elimina el `senasaSpeciesToCode` duplicado en `VaccineFormDialog` y usa el
normalizador compartido de la taxonomía de Pacientes (fuente única). Sin cambio
de comportamiento. Requiere `@coongro/patients` con el export nuevo.
