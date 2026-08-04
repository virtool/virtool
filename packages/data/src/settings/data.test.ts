import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import { settings } from "../db/schema/settings";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "./data";
import { seedSettings } from "./test/fixtures";

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

function countRows(): Promise<{ id: number }[]> {
	return db.select({ id: settings.id }).from(settings);
}

describe("getSettings", () => {
	it("returns the stored settings", async () => {
		await seedSettings(db, {
			defaultSourceTypes: ["genotype", "serotype"],
			enableApi: true,
			minimumPasswordLength: 12,
			sampleGroup: "force_choice",
		});

		await expect(getSettings(db)).resolves.toEqual({
			...DEFAULT_SETTINGS,
			defaultSourceTypes: ["genotype", "serotype"],
			enableApi: true,
			minimumPasswordLength: 12,
			sampleGroup: "force_choice",
		});
	});

	it("seeds the defaults when the row is absent", async () => {
		await expect(getSettings(db)).resolves.toEqual(DEFAULT_SETTINGS);
	});

	it("persists the defaults it seeds", async () => {
		await getSettings(db);

		const [row] = await db.select().from(settings);

		expect(row).toMatchObject({ id: 1, ...DEFAULT_SETTINGS });
	});

	it("leaves a single row when called repeatedly", async () => {
		await getSettings(db);
		await getSettings(db);

		await expect(countRows()).resolves.toHaveLength(1);
	});

	it("does not duplicate the row when called concurrently", async () => {
		const [first, second] = await Promise.all([
			getSettings(db),
			getSettings(db),
		]);

		expect(first).toEqual(DEFAULT_SETTINGS);
		expect(second).toEqual(DEFAULT_SETTINGS);
		await expect(countRows()).resolves.toHaveLength(1);
	});

	it("does not overwrite settings that are already stored", async () => {
		await seedSettings(db, { minimumPasswordLength: 20 });

		await getSettings(db);

		await expect(getSettings(db)).resolves.toMatchObject({
			minimumPasswordLength: 20,
		});
	});
});

describe("updateSettings", () => {
	it("applies the given values and returns the full settings", async () => {
		await seedSettings(db, { enableApi: false, minimumPasswordLength: 8 });

		await expect(
			updateSettings(db, { enableApi: true, minimumPasswordLength: 12 }),
		).resolves.toEqual({
			...DEFAULT_SETTINGS,
			enableApi: true,
			minimumPasswordLength: 12,
		});

		await expect(getSettings(db)).resolves.toMatchObject({
			enableApi: true,
			minimumPasswordLength: 12,
		});
	});

	it("leaves unspecified values untouched", async () => {
		await seedSettings(db, {
			defaultSourceTypes: ["genotype"],
			sampleGroup: "force_choice",
		});

		await updateSettings(db, { enableApi: true });

		await expect(getSettings(db)).resolves.toMatchObject({
			defaultSourceTypes: ["genotype"],
			sampleGroup: "force_choice",
			enableApi: true,
		});
	});

	it("seeds the defaults when the row is absent", async () => {
		await expect(updateSettings(db, { enableApi: true })).resolves.toEqual({
			...DEFAULT_SETTINGS,
			enableApi: true,
		});

		await expect(countRows()).resolves.toHaveLength(1);
	});

	it("returns the stored settings when given no values", async () => {
		await seedSettings(db, { minimumPasswordLength: 15 });

		await expect(updateSettings(db, {})).resolves.toMatchObject({
			minimumPasswordLength: 15,
		});
	});
});

describe("DEFAULT_SETTINGS", () => {
	// These are the values Python's `Settings` model declares and its
	// `d16de6e24788` migration seeds. A drift on either side means a virgin
	// deployment gets different settings depending on which service starts first.
	it("matches the defaults Python seeds", () => {
		expect(DEFAULT_SETTINGS).toEqual({
			defaultSourceTypes: ["isolate", "strain"],
			enableApi: false,
			enableSentry: true,
			minimumPasswordLength: 8,
			sampleAllRead: true,
			sampleAllWrite: false,
			sampleGroup: "none",
			sampleGroupRead: true,
			sampleGroupWrite: false,
		});
	});
});
