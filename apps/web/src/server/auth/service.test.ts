import {
	DEFAULT_MINIMUM_PASSWORD_LENGTH,
	PasswordTooShortError,
} from "@virtool/contracts";

import type { Db } from "@virtool/data/db/pg";
import { settings } from "@virtool/data/db/schema/settings";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedSettings } from "@virtool/data/settings/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checkConfiguredPasswordLength } from "./service";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(settings);
});

describe("checkConfiguredPasswordLength", () => {
	it("rejects a password one character short of the configured minimum", async () => {
		await seedSettings(db, { minimumPasswordLength: 12 });

		await expect(
			checkConfiguredPasswordLength(db, "a".repeat(11)),
		).rejects.toThrow("Password does not meet minimum length requirement (12)");
	});

	it("accepts a password of exactly the configured minimum", async () => {
		await seedSettings(db, { minimumPasswordLength: 12 });

		await expect(
			checkConfiguredPasswordLength(db, "a".repeat(12)),
		).resolves.toBeUndefined();
	});

	it("rejects a password the default minimum would have accepted", async () => {
		await seedSettings(db, { minimumPasswordLength: 20 });

		// Comfortably over the default, so this only fails against the configured
		// value — proof the setting is what's being read, not a constant.
		await expect(
			checkConfiguredPasswordLength(db, "a".repeat(16)),
		).rejects.toBeInstanceOf(PasswordTooShortError);
	});

	it("accepts a password the default minimum would have rejected", async () => {
		await seedSettings(db, { minimumPasswordLength: 4 });

		await expect(
			checkConfiguredPasswordLength(db, "a".repeat(4)),
		).resolves.toBeUndefined();
	});

	it("falls back to the seeded default when the settings row is absent", async () => {
		await expect(
			checkConfiguredPasswordLength(
				db,
				"a".repeat(DEFAULT_MINIMUM_PASSWORD_LENGTH - 1),
			),
		).rejects.toThrow(
			`Password does not meet minimum length requirement (${DEFAULT_MINIMUM_PASSWORD_LENGTH})`,
		);
	});
});
