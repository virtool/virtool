import {
	DEFAULT_MINIMUM_PASSWORD_LENGTH,
	type SampleGroup,
} from "@virtool/contracts";
import { eq } from "drizzle-orm";
import { CACHE_STORAGE_BUDGET_BYTES } from "../caches/data";
import type { Db } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import {
	type SettingsRow,
	settings as settingsTable,
} from "../db/schema/settings";
import type { EmailApiKeyEnvelope } from "../email/crypto";

/** The `settings` table holds a single row, pinned to this id by a check constraint. */
const SETTINGS_ID = 1;

/** Instance-wide settings. */
export type Settings = {
	/**
	 * The object-storage budget, in bytes, the LRU cache eviction task keeps the
	 * cache store under.
	 */
	cacheStorageBudget: number;
	defaultSourceTypes: string[];
	/**
	 * The stored Resend API key's encrypted envelope, or `null` when none is
	 * configured.
	 *
	 * A credential like {@link Settings.ncbiApiKey}, and treated the same way at
	 * the transport boundary: a client learns only whether a key is stored.
	 */
	emailApiKey: EmailApiKeyEnvelope | null;
	emailEnabled: boolean;
	emailReplyToAddress: string;
	emailSenderAddress: string;
	emailSenderName: string;
	enableSentry: boolean;
	minimumPasswordLength: number;
	/**
	 * The instance's NCBI API key, or `""` when none is configured.
	 *
	 * A credential, so it never leaves the server as-is —
	 * `apps/web/src/server/settings/functions.ts` reduces it to a boolean before
	 * publishing the row.
	 */
	ncbiApiKey: string;
	sampleAllRead: boolean;
	sampleAllWrite: boolean;
	sampleGroup: SampleGroup;
	sampleGroupRead: boolean;
	sampleGroupWrite: boolean;
};

/**
 * The values written when the settings row is missing.
 *
 * The columns carry no server defaults, so every one has to be supplied on
 * insert and the defaults live here in code rather than in the schema.
 */
export const DEFAULT_SETTINGS: Settings = {
	cacheStorageBudget: CACHE_STORAGE_BUDGET_BYTES,
	defaultSourceTypes: ["isolate", "strain"],
	emailApiKey: null,
	emailEnabled: false,
	emailReplyToAddress: "",
	emailSenderAddress: "",
	emailSenderName: "",
	enableSentry: true,
	minimumPasswordLength: DEFAULT_MINIMUM_PASSWORD_LENGTH,
	ncbiApiKey: "",
	sampleAllRead: true,
	sampleAllWrite: false,
	sampleGroup: "none",
	sampleGroupRead: true,
	sampleGroupWrite: false,
};

function toSettings(row: SettingsRow): Settings {
	return {
		cacheStorageBudget: row.cacheStorageBudget,
		defaultSourceTypes: row.defaultSourceTypes,
		emailApiKey: row.emailApiKey,
		emailEnabled: row.emailEnabled,
		emailReplyToAddress: row.emailReplyToAddress,
		emailSenderAddress: row.emailSenderAddress,
		emailSenderName: row.emailSenderName,
		enableSentry: row.enableSentry,
		minimumPasswordLength: row.minimumPasswordLength,
		ncbiApiKey: row.ncbiApiKey,
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
 * The row is there in practice, the migration inserting it, but a database
 * that has never had one must still answer. Seeding on read makes this an
 * ensure — the row exists by the time it returns — and keeps the read total,
 * rather than failing a caller that only wanted the minimum password length.
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
 * Seeds the defaults first when the row is absent, mirroring `getSettings`, so
 * a patch against a database with no settings row still writes onto a complete
 * row rather than failing.
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
