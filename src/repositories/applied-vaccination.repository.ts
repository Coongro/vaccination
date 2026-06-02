import { eq, isNull, desc } from 'drizzle-orm';
import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { appliedVaccinationTable } from '../schema/applied-vaccination.js';
import type { AppliedVaccinationRow, NewAppliedVaccinationRow } from '../schema/applied-vaccination.js';

export class AppliedVaccinationRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<AppliedVaccinationRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(appliedVaccinationTable)
        .where(isNull(appliedVaccinationTable.deleted_at))
        .orderBy(desc(appliedVaccinationTable.applied_date))
    );
  }

  async getById({ id }: { id: string }): Promise<AppliedVaccinationRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(appliedVaccinationTable).where(eq(appliedVaccinationTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewAppliedVaccinationRow }): Promise<AppliedVaccinationRow[]> {
    return this.db.ormQuery((tx) =>
      tx.insert(appliedVaccinationTable).values(data).returning()
    );
  }

  async update({ id, data }: { id: string; data: Partial<NewAppliedVaccinationRow> }): Promise<AppliedVaccinationRow[]> {
    return this.db.ormQuery((tx) =>
      tx.update(appliedVaccinationTable).set(data).where(eq(appliedVaccinationTable.id, id)).returning()
    );
  }

  async delete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) =>
      tx.delete(appliedVaccinationTable).where(eq(appliedVaccinationTable.id, id))
    );
  }

  async softDelete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) =>
      tx
        .update(appliedVaccinationTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ deleted_at: new Date().toISOString() } as any)
        .where(eq(appliedVaccinationTable.id, id))
    );
  }
}
