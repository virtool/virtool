DROP INDEX "users_handle_lower_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_lower_unique" ON "users" USING btree (lower("handle")) WHERE "users"."handle" <> '';