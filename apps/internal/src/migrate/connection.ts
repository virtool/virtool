import { hostname } from "node:os";
import { buildApplicationName } from "@virtool/data/db/applicationName";
import type { DbHandles } from "@virtool/data/db/pg";
import * as schema from "@virtool/data/db/schema/index";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/** A non-rotating session that stops permanently if its advisory lock connection is lost. */
export function createMigrationDb(
	postgresUrl: string,
	controller: AbortController,
): DbHandles {
	const applicationName = buildApplicationName("migrate", hostname());
	const client = postgres(postgresUrl, {
		max: 1,
		idle_timeout: 0,
		max_lifetime: 0,
		connection: { application_name: applicationName },
		onclose() {
			controller.abort(new Error("migration database connection closed"));
			// A reconnected session would no longer own the advisory lock.
			void client.end({ timeout: 0 });
		},
	});
	return { client, db: drizzle(client, { schema }), applicationName };
}
