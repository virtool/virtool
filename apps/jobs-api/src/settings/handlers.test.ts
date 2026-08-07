import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { settings } from "@virtool/data/db/schema/settings";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { DEFAULT_SETTINGS } from "@virtool/data/settings/data";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import type { ReadHandlerDeps } from "../http";
import { handleGetSettings } from "./handlers";

let database: TestDatabase;
let db: Db;
let deps: ReadHandlerDeps;
let credential: string;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(settings);
	await db.delete(jobs);
	await db.delete(users);

	const job = await seedJob(db, await seedUser(db), { workflow: "pathoscope" });

	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	deps = { db };
});

function get(authenticated = true): Request {
	return new Request("https://jobs.virtool.test/settings", {
		headers: authenticated ? { authorization: `Basic ${credential}` } : {},
	});
}

describe("handleGetSettings", () => {
	it("serves the settings row", async () => {
		await db.insert(settings).values({
			id: 1,
			...DEFAULT_SETTINGS,
			sampleAllWrite: true,
			minimumPasswordLength: 12,
		});

		const response = await handleGetSettings(deps, get());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			...DEFAULT_SETTINGS,
			sampleAllWrite: true,
			minimumPasswordLength: 12,
		});
	});

	// The one read in this service that writes. `getSettings` seeds the defaults
	// when the row is absent, mirroring Python's `SettingsData.ensure()`, so a
	// database that has never seen a Python boot answers rather than failing.
	it("seeds the defaults when the row is absent", async () => {
		const response = await handleGetSettings(deps, get());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(DEFAULT_SETTINGS);
		expect(await db.select().from(settings)).toHaveLength(1);
	});

	it("refuses an unauthenticated request", async () => {
		const response = await handleGetSettings(deps, get(false));

		expect(response.status).toBe(401);
		expect(await db.select().from(settings)).toEqual([]);
	});
});
