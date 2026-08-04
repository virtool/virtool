import type { Db } from "../../db/pg";
import { settings } from "../../db/schema/settings";
import { DEFAULT_SETTINGS, type Settings } from "../data";

/**
 * Insert the singleton settings row, overriding any of the defaults.
 *
 * A test database is built from the Drizzle schema alone, so it starts with an
 * empty `settings` table — unlike production, where Python seeds the row. A
 * test that wants settings to already exist must call this.
 */
export async function seedSettings(
	db: Db,
	overrides: Partial<Settings> = {},
): Promise<Settings> {
	const values = { ...DEFAULT_SETTINGS, ...overrides };

	await db
		.insert(settings)
		.values({ id: 1, ...values })
		.onConflictDoNothing();

	return values;
}
