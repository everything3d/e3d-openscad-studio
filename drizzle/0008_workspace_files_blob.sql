ALTER TABLE "workspace_files" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_files" ADD COLUMN "blob_path" text;--> statement-breakpoint
ALTER TABLE "workspace_files" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_has_bytes" CHECK ("workspace_files"."data" is not null or "workspace_files"."blob_path" is not null);