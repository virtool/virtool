CREATE TABLE "setup_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "setup_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" integer NOT NULL,
	"purpose" text NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "setup_sessions_session_id_key" UNIQUE("session_id"),
	CONSTRAINT "setup_sessions_purpose_valid" CHECK (purpose in ('account_completion', 'email_remediation', 'totp_enrollment'))
);
--> statement-breakpoint
CREATE TABLE "setup_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "setup_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	CONSTRAINT "setup_tokens_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "setup_tokens_purpose_valid" CHECK (purpose in ('account_completion', 'email_remediation', 'totp_enrollment'))
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lifecycle_state" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "setup_sessions" ADD CONSTRAINT "setup_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_tokens" ADD CONSTRAINT "setup_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_setup_sessions_expires_at" ON "setup_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_setup_sessions_user_id" ON "setup_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_setup_tokens_expires_at" ON "setup_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_setup_tokens_user_id_purpose" ON "setup_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "lifecycle_state_valid" CHECK ("users"."lifecycle_state" in ('pending', 'normal'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "pending_has_no_password" CHECK ("users"."lifecycle_state" <> 'pending' or "users"."password" is null);