
import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq } from 'drizzle-orm';

import { vaccineComponentTable } from '../schema/vaccine-component.js';
import type { VaccineComponentRow, NewVaccineComponentRow } from '../schema/vaccine-component.js';

/**
 * Composición de vacunas (agentes etiológicos / cepas). Mismo contrato que el
 * repo de componentes de medicamentos: list / create / delete, con orden estable
 * por `position`. La reconciliación al editar (crear-antes-de-borrar) vive en el
 * consumidor, igual que en vet-pharmacy.
 */
export class VaccineComponentRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<VaccineComponentRow[]> {
    return this.db.ormQuery((tx) =>
      tx.select().from(vaccineComponentTable).orderBy(vaccineComponentTable.position)
    );
  }

  async listByDetail({
    vaccineDetailId,
  }: {
    vaccineDetailId: string;
  }): Promise<VaccineComponentRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(vaccineComponentTable)
        .where(eq(vaccineComponentTable.vaccine_detail_id, vaccineDetailId))
        .orderBy(vaccineComponentTable.position)
    );
  }

  async create({ data }: { data: NewVaccineComponentRow }): Promise<VaccineComponentRow[]> {
    // El id (uuid PK notNull) se genera acá si no viene: la columna no tiene
    // default, así que sin esto violaría la not-null constraint.
    const row = { ...data, id: data.id ?? crypto.randomUUID() };
    return this.db.ormQuery((tx) => tx.insert(vaccineComponentTable).values(row).returning());
  }

  async delete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) =>
      tx.delete(vaccineComponentTable).where(eq(vaccineComponentTable.id, id))
    );
  }
}