import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const laboratoryTable = pgTable('module_vaccination_laboratories', {
  id: uuid('id').primaryKey().notNull(),
  name: text('name').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  deleted_at: timestamp('deleted_at', { mode: 'string' }),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export type LaboratoryRow = typeof laboratoryTable.$inferSelect;
export type NewLaboratoryRow = typeof laboratoryTable.$inferInsert;
