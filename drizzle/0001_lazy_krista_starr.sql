CREATE TABLE "module_vaccination_applied_vaccinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"patient_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"applied_date" text NOT NULL,
	"weight_kg" numeric,
	"staff_id" uuid,
	"dose_number" integer,
	"next_dose_date" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
