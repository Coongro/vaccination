import { sql } from 'drizzle-orm';
import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const appliedVaccinationTable = pgTable('module_vaccination_applied_vaccinations', {
  id: uuid('id').primaryKey().notNull(),
  patient_id: uuid('patient_id').notNull(),
  product_id: uuid('product_id').notNull(),
  variant_id: uuid('variant_id'),
  applied_date: text('applied_date').notNull(),
  weight_kg: numeric('weight_kg'),
  staff_id: uuid('staff_id'),
  dose_number: integer('dose_number'),
  next_dose_date: text('next_dose_date'),
  notes: text('notes'),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  deleted_at: timestamp('deleted_at', { mode: 'string' }),
});

export type AppliedVaccinationRow = typeof appliedVaccinationTable.$inferSelect;
export type NewAppliedVaccinationRow = typeof appliedVaccinationTable.$inferInsert;
