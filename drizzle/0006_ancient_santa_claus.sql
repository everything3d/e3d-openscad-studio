CREATE TABLE "print_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"draft_order_id" text NOT NULL,
	"draft_order_name" text NOT NULL,
	"invoice_url" text,
	"total_inr" integer NOT NULL,
	"print_minutes" integer NOT NULL,
	"filament_grams" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_orders_user_created_idx" ON "print_orders" USING btree ("user_id","created_at");