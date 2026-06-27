---
"@coongro/vaccination": minor
---

Autofill de alta de vacunas vía buscador del vademécum SENASA (COONG-224): el alta/edición de vacunas integra el buscador compartido (`@coongro/vademecum`) filtrando por vacunas, y autocompleta nombre, laboratorio, especies, vía, tipo, registro, presentación, indicaciones, vigencia y composición (agentes etiológicos/cepas). El esquema de dosis y la edad mínima se infieren best-effort del texto de SENASA (fail-safe y acotado, marcado como "sugerido"). Se agrega al modelo la tabla `vaccine_components` + columnas de registro/presentación/indicaciones/vigencia (migración 0004). El catálogo se consolida en `useVaccineCatalog` como fuente única (datos + CRUD), consumido por la vista; `uuid()` con fallback para contextos inseguros.
