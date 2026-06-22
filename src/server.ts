/**
 * @coongro/vaccination — Exportaciones server-only
 *
 * Schema tables y repositories (dependen de drizzle-orm).
 * NO importar desde el browser — usar '@coongro/vaccination' para hooks/componentes.
 */
export * from './schema/vaccine-detail.js';
export { VaccineDetailRepository } from './repositories/vaccine-detail.repository.js';
export * from './schema/applied-vaccination.js';
export { AppliedVaccinationRepository } from './repositories/applied-vaccination.repository.js';
