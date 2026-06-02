import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, isNull, and, asc } from 'drizzle-orm';

import { laboratoryTable } from '../schema/laboratory.js';
import type { LaboratoryRow, NewLaboratoryRow } from '../schema/laboratory.js';

export class LaboratoryRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<LaboratoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(laboratoryTable)
        .where(isNull(laboratoryTable.deleted_at))
        .orderBy(asc(laboratoryTable.name))
    );
  }

  async listActive(): Promise<LaboratoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(laboratoryTable)
        .where(and(isNull(laboratoryTable.deleted_at), eq(laboratoryTable.is_active, true)))
        .orderBy(asc(laboratoryTable.name))
    );
  }

  async getById({ id }: { id: string }): Promise<LaboratoryRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(laboratoryTable).where(eq(laboratoryTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewLaboratoryRow }): Promise<LaboratoryRow[]> {
    return this.db.ormQuery((tx) => tx.insert(laboratoryTable).values(data).returning());
  }

  async update({
    id,
    data,
  }: {
    id: string;
    data: Partial<NewLaboratoryRow>;
  }): Promise<LaboratoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(laboratoryTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ ...data, updated_at: new Date().toISOString() } as any)
        .where(eq(laboratoryTable.id, id))
        .returning()
    );
  }

  async softDelete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) =>
      tx
        .update(laboratoryTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ deleted_at: new Date().toISOString(), is_active: false } as any)
        .where(eq(laboratoryTable.id, id))
    );
  }
}
