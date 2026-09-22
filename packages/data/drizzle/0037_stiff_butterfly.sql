UPDATE "auth_sessions"
SET "ip_address" = left(regexp_replace("ip_address", '[[:cntrl:]]', ' ', 'g'), 45),
	"user_agent" = left(regexp_replace("user_agent", '[[:cntrl:]]', ' ', 'g'), 512);--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "ip_address" SET DATA TYPE varchar(45);--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "user_agent" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "browser" varchar(80) DEFAULT 'Unknown browser' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "operating_system" varchar(80) DEFAULT 'Unknown operating system' NOT NULL;
