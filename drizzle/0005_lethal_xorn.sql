CREATE TABLE "model_calls" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "model_calls_user_created_idx" ON "model_calls" USING btree ("user_id","created_at");