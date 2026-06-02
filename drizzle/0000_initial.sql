CREATE TABLE "module_vaccination_laboratories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_vaccination_vaccine_details" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"laboratory_id" uuid NOT NULL,
	"species" jsonb NOT NULL,
	"vaccine_type" text NOT NULL,
	"administration_route" text NOT NULL,
	"minimum_age_months" integer,
	"schedule_doses" integer,
	"schedule_interval_days" integer,
	"notes" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
