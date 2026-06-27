CREATE TABLE "module_vaccination_vaccine_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vaccine_detail_id" uuid NOT NULL,
	"agent" text NOT NULL,
	"raw_strength" text,
	"source" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "module_vaccination_vaccine_details" ADD COLUMN "senasa_registration" text;--> statement-breakpoint
ALTER TABLE "module_vaccination_vaccine_details" ADD COLUMN "presentation" text;--> statement-breakpoint
ALTER TABLE "module_vaccination_vaccine_details" ADD COLUMN "indications" text;--> statement-breakpoint
ALTER TABLE "module_vaccination_vaccine_details" ADD COLUMN "senasa_status" text;--> statement-breakpoint
CREATE INDEX "idx_vaccination_vaccine_components_detail" ON "module_vaccination_vaccine_components" USING btree ("vaccine_detail_id");