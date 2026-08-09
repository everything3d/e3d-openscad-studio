DROP INDEX "projects_user_shared_from_unique";--> statement-breakpoint
ALTER TABLE "project_shares" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "organization_id" text;--> statement-breakpoint
CREATE INDEX "projects_user_updated_at_idx" ON "projects" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "projects_organization_updated_at_idx" ON "projects" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_organization_shared_from_unique" ON "projects" USING btree ("organization_id","shared_from") WHERE "projects"."organization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_shared_from_unique" ON "projects" USING btree ("user_id","shared_from") WHERE "projects"."organization_id" is null;