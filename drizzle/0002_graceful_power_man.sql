CREATE TABLE "project_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"token" text NOT NULL,
	"snapshot_name" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_shares_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "project_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "shared_from" text;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_shared_from_unique" ON "projects" USING btree ("user_id","shared_from");