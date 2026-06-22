import type { ModuleActivationContext, ModuleDatabaseAPI, Logger } from '@coongro/plugin-sdk';
import { categoryTable, productTable } from '@coongro/products/server';
import { LaboratoryRepository } from '@coongro/vademecum/server';
import { eq, isNull } from 'drizzle-orm';

import { VACCINE_CATEGORY_SLUG, LABORATORIES, VACCINE_PRODUCTS } from './constants/seed-data.js';
import { vaccineDetailTable } from './schema/vaccine-detail.js';

export async function activate(context: ModuleActivationContext): Promise<void> {
  const { api } = context;

  if (!api.database) {
    api.logger.error('Cannot seed: database API not available');
    return;
  }

  try {
    await seedVaccinationData(api.database, api.logger);
  } catch (err) {
    api.logger.error('Failed to seed vaccination data', err);
  }

  // Recuperación del laboratorio para vacunas que quedaron huérfanas (COONG-219):
  // al migrar al maestro compartido se dropeó la tabla vieja, así que los
  // `vaccine_details` seedeados antes quedaron con un `laboratory_id` que ya no
  // existe en ningún maestro. Se re-vincula recuperando el nombre del lab desde
  // los datos del seed (producto → laboratorio) y materializándolo en el maestro.
  try {
    await relinkOrphanedLaboratories(api.database, api.logger);
  } catch (err) {
    api.logger.error('Failed to relink vaccination laboratories', err);
  }
}

interface ProductNameRow {
  id: string;
  name: string;
}
interface VaccineDetailLabRow {
  id: string;
  product_id: string;
  laboratory_id: string | null;
}

async function relinkOrphanedLaboratories(db: ModuleDatabaseAPI, logger: Logger): Promise<void> {
  const labRepo = new LaboratoryRepository(db);
  const masterIds = new Set((await labRepo.list()).map((l) => l.id));

  const details = (await db.ormQuery((tx) =>
    tx
      .select({
        id: vaccineDetailTable.id,
        product_id: vaccineDetailTable.product_id,
        laboratory_id: vaccineDetailTable.laboratory_id,
      })
      .from(vaccineDetailTable)
      .where(isNull(vaccineDetailTable.deleted_at))
  )) as VaccineDetailLabRow[];

  const orphans = details.filter((d) => !d.laboratory_id || !masterIds.has(d.laboratory_id));
  if (orphans.length === 0) return;

  // Nombre del producto (para cruzar contra el seed) + lab por nombre de vacuna.
  const products = (await db.ormQuery((tx) =>
    tx.select({ id: productTable.id, name: productTable.name }).from(productTable)
  )) as ProductNameRow[];
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const labByVaccineName = new Map(VACCINE_PRODUCTS.map((v) => [v.name, v.laboratory]));

  const idByLabName = new Map<string, string>();
  let relinked = 0;
  for (const d of orphans) {
    const productName = productNameById.get(d.product_id);
    const labName = productName ? labByVaccineName.get(productName) : undefined;
    if (!labName) continue;
    let labId = idByLabName.get(labName);
    if (!labId) {
      const row = await labRepo.ensureByName({ name: labName });
      labId = row.id;
      idByLabName.set(labName, labId);
    }
    await db.ormQuery((tx) =>
      tx
        .update(vaccineDetailTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ laboratory_id: labId } as any)
        .where(eq(vaccineDetailTable.id, d.id))
    );
    relinked += 1;
  }
  if (relinked > 0) logger.info(`vaccination: relinked ${relinked} vaccine laboratories to master`);
}

async function isAlreadySeeded(db: ModuleDatabaseAPI): Promise<boolean> {
  const existing = await db.ormQuery((tx) =>
    tx
      .select({ id: categoryTable.id })
      .from(categoryTable)
      .where(eq(categoryTable.slug, VACCINE_CATEGORY_SLUG))
      .limit(1)
  );
  return existing.length > 0;
}

async function seedCategory(db: ModuleDatabaseAPI): Promise<string> {
  const id = crypto.randomUUID();
  await db.ormQuery((tx) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    tx.insert(categoryTable).values({
      id,
      name: 'Vacunas',
      slug: VACCINE_CATEGORY_SLUG,
      description: 'Productos vacunales del catálogo veterinario',
      icon: 'syringe',
      color: '#10B981',
      order: 100,
      metadata: { _seeded: true, plugin: 'vaccination' },
    } as any)
  );
  return id;
}

async function seedLaboratories(db: ModuleDatabaseAPI): Promise<Map<string, string>> {
  // Los laboratorios viven en el maestro compartido (vademecum), no en una tabla
  // propia de vacunación (COONG-219). Se hace upsert por nombre para no duplicar
  // los que ya cargó Farmacia u otro seed, y se reusa su id para los productos.
  const labRepo = new LaboratoryRepository(db);
  const labMap = new Map<string, string>();
  for (const lab of LABORATORIES) {
    const row = await labRepo.ensureByName({ name: lab.name });
    labMap.set(lab.name, row.id);
  }
  return labMap;
}

async function seedProducts(
  db: ModuleDatabaseAPI,
  categoryId: string,
  labMap: Map<string, string>,
  logger: Logger
): Promise<void> {
  const productValues: any[] = [];
  const detailValues: any[] = [];

  for (const vaccine of VACCINE_PRODUCTS) {
    const laboratoryId = labMap.get(vaccine.laboratory);
    if (!laboratoryId) {
      logger.warn(`Laboratory "${vaccine.laboratory}" not found, skipping: ${vaccine.name}`);
      continue;
    }

    const productId = crypto.randomUUID();

    productValues.push({
      id: productId,
      name: vaccine.name,
      category_id: categoryId,
      sale_price: vaccine.suggestedPrice ?? null,
      tags: [vaccine.vaccineType],
      metadata: { _seeded: true, plugin: 'vaccination' },
    });

    detailValues.push({
      id: crypto.randomUUID(),
      product_id: productId,
      laboratory_id: laboratoryId,
      species: vaccine.species,
      vaccine_type: vaccine.vaccineType,
      administration_route: vaccine.administrationRoute,
      minimum_age_months: vaccine.minimumAgeMonths ?? null,
      schedule_doses: vaccine.scheduleDoses ?? null,
      schedule_interval_days: vaccine.scheduleIntervalDays ?? null,
      notes: vaccine.notes ?? null,
    });
  }

  const BATCH_SIZE = 25;
  for (let i = 0; i < productValues.length; i += BATCH_SIZE) {
    const productBatch = productValues.slice(i, i + BATCH_SIZE);
    const detailBatch = detailValues.slice(i, i + BATCH_SIZE);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await db.ormQuery((tx) => tx.insert(productTable).values(productBatch));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await db.ormQuery((tx) => tx.insert(vaccineDetailTable).values(detailBatch));
  }
}

async function seedVaccinationData(db: ModuleDatabaseAPI, logger: Logger): Promise<void> {
  if (await isAlreadySeeded(db)) {
    logger.debug('Vaccination data already seeded, skipping');
    return;
  }

  logger.info('Seeding vaccination data...');

  const categoryId = await seedCategory(db);
  const labMap = await seedLaboratories(db);
  await seedProducts(db, categoryId, labMap, logger);

  logger.info(
    `Vaccination seed complete: ${LABORATORIES.length} laboratories, ${VACCINE_PRODUCTS.length} products`
  );
}
