/**
 * @coongro/vaccination — Entry point principal (browser-safe)
 */

export type { VaccineType, AdministrationRoute } from './types/vaccination.js';

export { VACCINE_TYPE_LABELS, ADMINISTRATION_ROUTE_LABELS } from './types/vaccination.js';

export { useLaboratories } from './hooks/useLaboratories.js';
export type { UseLaboratoriesResult } from './hooks/useLaboratories.js';

export { useVaccineCatalog } from './hooks/useVaccineCatalog.js';
export type {
  VaccineCatalogItem,
  CatalogFilters,
  UseVaccineCatalogResult,
  CreateVaccineData,
  UpdateVaccineData,
} from './hooks/useVaccineCatalog.js';

export { VaccineFormDialog } from './components/VaccineFormDialog.js';
export { LaboratoryDrawer } from './components/LaboratoryDrawer.js';
export { ProductDetailDrawer } from './components/ProductDetailDrawer.js';
