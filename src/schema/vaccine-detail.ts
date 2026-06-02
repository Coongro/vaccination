import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const vaccineDetailTable = pgTable('module_vaccination_vaccine_details', {
  id: uuid('id').primaryKey().notNull(),
  product_id: uuid('product_id').notNull(),
  laboratory_id: uuid('laboratory_id').notNull(),
  species: jsonb('species').notNull(),
  vaccine_type: text('vaccine_type').notNull(),
  administration_route: text('administration_route').notNull(),
  minimum_age_months: integer('minimum_age_months'),
  schedule_doses: integer('schedule_doses'),
  schedule_interval_days: integer('schedule_interval_days'),
  notes: text('notes'),
  deleted_at: timestamp('deleted_at', { mode: 'string' }),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export type VaccineDetailRow = typeof vaccineDetailTable.$inferSelect;
export type NewVaccineDetailRow = typeof vaccineDetailTable.$inferInsert;
