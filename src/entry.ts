import type { ModuleActivationContext, ModuleDatabaseAPI, Logger } from '@coongro/plugin-sdk';
import { categoryTable, productTable } from '@coongro/products/server';
import { eq } from 'drizzle-orm';

import { VACCINE_CATEGORY_SLUG, LABORATORIES, VACCINE_PRODUCTS } from './constants/seed-data.js';
import { laboratoryTable } from './schema/laboratory.js';
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
  const labMap = new Map<string, string>();
  const labValues = LABORATORIES.map((lab) => {
    const id = crypto.randomUUID();
    labMap.set(lab.name, id);
    return { id, name: lab.name, is_active: true };
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await db.ormQuery((tx) => tx.insert(laboratoryTable).values(labValues as any));

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
