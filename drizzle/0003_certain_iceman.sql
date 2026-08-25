CREATE TABLE "canonical_designs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"current_version_id" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_design_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"code" text NOT NULL,
	"files" jsonb NOT NULL,
	"modification_guide" text NOT NULL,
	"thumbnail" text,
	"change_summary" text,
	"source_project_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "canonical_design_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "canonical_version_id" text;--> statement-breakpoint
ALTER TABLE "canonical_versions" ADD CONSTRAINT "canonical_versions_canonical_design_id_canonical_designs_id_fk" FOREIGN KEY ("canonical_design_id") REFERENCES "public"."canonical_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_versions_design_version_unique" ON "canonical_versions" USING btree ("canonical_design_id","version_number");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_canonical_design_id_canonical_designs_id_fk" FOREIGN KEY ("canonical_design_id") REFERENCES "public"."canonical_designs"("id") ON DELETE set null ON UPDATE no action;