import { DEFAULT_MINIMUM_PASSWORD_LENGTH } from "@virtool/contracts";
import { eq } from "drizzle-orm";
import type { Db } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import {
	type SampleGroup,
	type SettingsRow,
	settings as settingsTable,
} from "../db/schema/settings";

/** The `settings` table holds a single row, pinned to this id by a check constraint. */
const SETTINGS_ID = 1;

/** Instance-wide settings. */
export type Settings = {
	defaultSourceTypes: string[];
	enableSentry: boolean;
	minimumPasswordLength: number;
	sampleAllRead: boolean;
	sampleAllWrite: boolean;
	sampleGroup: SampleGroup;
	sampleGroupRead: boolean;
	sampleGroupWrite: boolean;
};

/**
 * The values written when the settings row is missing.
 *
 * Mirrors the defaults on Python's `Settings` model, which are the same values
 * its `d16de6e24788` migration seeds the row with. The columns themselves have
 * no server default, so every one must be supplied on insert.
 */
export const DEFAULT_SETTINGS: Settings = {
	defaultSourceTypes: ["isolate", "strain"],
	enableSentry: true,
	minimumPasswordLength: DEFAULT_MINIMUM_PASSWORD_LENGTH,
	sampleAllRead: true,
	sampleAllWrite: false,
	sampleGroup: "none",
	sampleGroupRead: true,
	sampleGroupWrite: false,
};

function toSettings(row: SettingsRow): Settings {
	return {
		defaultSourceTypes: row.defaultSourceTypes,
		enableSentry: row.enableSentry,
		minimumPasswordLength: row.minimumPasswordLength,
		sampleAllRead: row.sampleAllRead,
		sampleAllWrite: row.sampleAllWrite,
		sampleGroup: row.sampleGroup,
		sampleGroupRead: row.sampleGroupRead,
		sampleGroupWrite: row.sampleGroupWrite,
	};
}

function selectSettings(db: Db): Promise<SettingsRow[]> {
	return db
		.select()
		.from(settingsTable)
		.where(eq(settingsTable.id, SETTINGS_ID));
}

/**
 * Get the instance settings, seeding the defaults when the row is absent.
 *
 * Python guarantees the row in practice — its migration inserts it and
 * `SettingsData.ensure()` re-seeds it at startup — but a database that has yet
 * to see a Python boot has none. Writing the defaults here mirrors `ensure()`
 * and keeps the read total, rather than failing a caller that only wanted the
 * minimum password length.
 */
export async function getSettings(db: Db): Promise<Settings> {
	const existing = takeFirst(await selectSettings(db));

	if (existing) {
		return toSettings(existing);
	}

	const seeded = takeFirst(
		await db
			.insert(settingsTable)
			.values({ id: SETTINGS_ID, ...DEFAULT_SETTINGS })
			.onConflictDoNothing()
			.returning(),
	);

	if (seeded) {
		return toSettings(seeded);
	}

	// The insert was a no-op, so a concurrent caller seeded the row first.
	return toSettings(takeFirstOrThrow(await selectSettings(db)));
}

/**
 * Update the instance settings, returning the full row after the change.
 *
 * Seeds the defaults first when the row is absent, mirroring `getSettings`, so a
 * patch against a database that has never seen a Python boot still writes onto a
 * complete row rather than failing.
 */
export async function updateSettings(
	db: Db,
	values: Partial<Settings>,
): Promise<Settings> {
	const current = await getSettings(db);

	if (Object.keys(values).length === 0) {
		return current;
	}

	return toSettings(
		takeFirstOrThrow(
			await db
				.update(settingsTable)
				.set(values)
				.where(eq(settingsTable.id, SETTINGS_ID))
				.returning(),
		),
	);
}
