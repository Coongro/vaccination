import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

/**
 * Composición de una vacuna: lista de agentes etiológicos / antígenos / cepas
 * (ej. Distemper, Parvovirus, Rabia). Es el análogo de `medication_components`
 * de vet-pharmacy, pero para biológicos: el equivalente del "principio activo"
 * de un medicamento es acá el agente que la vacuna inmuniza.
 *
 * Se modela relacional (no un array JSON) por las mismas razones que en
 * medicamentos: queda queryable —"qué vacunas cubren Parvovirus"— y lista para
 * cruces a futuro (calendarios por enfermedad, alertas de cobertura) sin
 * re-migrar.
 *
 * `raw_strength` conserva el título/concentración crudo de la fuente si lo trae
 * (los antígenos suelen venir como título, ej. "10^3 DICC50", no como mg/ml, por
 * eso no se parsea a cantidad+unidad). `source` registra el origen ('senasa' o
 * null si lo cargó el vet). `position` fija el orden estable (0-based) con que se
 * muestran y editan los agentes.
 */
export const vaccineComponentTable = pgTable(
  'module_vaccination_vaccine_components',
  {
    id: uuid('id').primaryKey().notNull(),
    vaccine_detail_id: uuid('vaccine_detail_id').notNull(),
    agent: text('agent').notNull(),
    raw_strength: text('raw_strength'),
    source: text('source'),
    // NOT NULL + DEFAULT: si el plugin se desactiva, inserts de otros plugins no
    // fallan; y los componentes preexistentes quedan en 0 (orden de inserción).
    position: integer('position').notNull().default(0),
  },
  (t) => [index('idx_vaccination_vaccine_components_detail').on(t.vaccine_detail_id)]
);

export type VaccineComponentRow = typeof vaccineComponentTable.$inferSelect;
export type NewVaccineComponentRow = typeof vaccineComponentTable.$inferInsert;
