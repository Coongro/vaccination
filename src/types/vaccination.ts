export type VaccineType = 'core' | 'non_core' | 'rabies' | 'other';

export type AdministrationRoute =
  | 'subcutaneous'
  | 'intramuscular'
  | 'intranasal'
  | 'oral'
  | 'other';

export const VACCINE_TYPE_LABELS: Record<VaccineType, string> = {
  core: 'Núcleo',
  non_core: 'No núcleo',
  rabies: 'Antirrábica',
  other: 'Otra',
};

export const ADMINISTRATION_ROUTE_LABELS: Record<AdministrationRoute, string> = {
  subcutaneous: 'Subcutánea',
  intramuscular: 'Intramuscular',
  intranasal: 'Intranasal',
  oral: 'Oral',
  other: 'Otra',
};
