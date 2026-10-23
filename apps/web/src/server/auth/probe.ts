import type { Db } from "@virtool/data/db/pg";
import { sql } from "drizzle-orm";

/**
 * Throw the database's own error when Postgres cannot be reached.
 *
 * Better Auth hides a failed query behind its own error or a bare 500. Calling
 * this after such a failure lets the outage middleware see the real cause and
 * answer 503 rather than report it.
 */
export async function assertDatabaseReachable(db: Db): Promise<void> {
	await db.execute(sql`select 1`);
}
