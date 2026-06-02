import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, isNull, and } from 'drizzle-orm';

import { vaccineDetailTable } from '../schema/vaccine-detail.js';
import type { VaccineDetailRow, NewVaccineDetailRow } from '../schema/vaccine-detail.js';

export interface VaccineCatalogSearchParams {
  query?: string;
  laboratoryId?: string;
  vaccineType?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export class VaccineDetailRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<VaccineDetailRow[]> {
    return this.db.ormQuery((tx) =>
      tx.select().from(vaccineDetailTable).where(isNull(vaccineDetailTable.deleted_at))
    );
  }

  async getById({ id }: { id: string }): Promise<VaccineDetailRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(vaccineDetailTable).where(eq(vaccineDetailTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async getByProductId({
    productId,
  }: {
    productId: string;
  }): Promise<VaccineDetailRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select()
        .from(vaccineDetailTable)
        .where(
          and(eq(vaccineDetailTable.product_id, productId), isNull(vaccineDetailTable.deleted_at))
        )
        .limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewVaccineDetailRow }): Promise<VaccineDetailRow[]> {
    return this.db.ormQuery((tx) => tx.insert(vaccineDetailTable).values(data).returning());
  }

  async update({
    id,
    data,
  }: {
    id: string;
    data: Partial<NewVaccineDetailRow>;
  }): Promise<VaccineDetailRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(vaccineDetailTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ ...data, updated_at: new Date().toISOString() } as any)
        .where(eq(vaccineDetailTable.id, id))
        .returning()
    );
  }

  async softDelete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) =>
      tx
        .update(vaccineDetailTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ deleted_at: new Date().toISOString() } as any)
        .where(eq(vaccineDetailTable.id, id))
    );
  }
}
