ALTER TABLE "module_vaccination_applied_vaccinations" DROP COLUMN "variant_id";--> statement-breakpoint
ALTER TABLE "module_vaccination_applied_vaccinations" ADD COLUMN "batch_id" uuid;