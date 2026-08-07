import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { legacyReferences } from "@virtool/data/db/schema/references";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedReference } from "@virtool/data/indexes/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import type { ReadHandlerDeps } from "../http";
import { handleGetReference } from "./handlers";

let database: TestDatabase;
let db: Db;
let deps: ReadHandlerDeps;
let credential: string;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyReferences);
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db);

	const job = await seedJob(db, userId, { workflow: "pathoscope" });

	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	deps = { db };
});

function get(referenceId: number | string, authenticated = true): Request {
	return new Request(`https://jobs.virtool.test/refs/${referenceId}`, {
		headers: authenticated ? { authorization: `Basic ${credential}` } : {},
	});
}

describe("handleGetReference", () => {
	it("serves the reference's metadata", async () => {
		const referenceId = await seedReference(db, userId, {
			name: "Plant viruses",
		});

		const response = await handleGetReference(
			deps,
			get(referenceId),
			String(referenceId),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: referenceId,
			dataType: expect.any(String),
			description: "",
			name: "Plant viruses",
			organism: "virus",
		});
	});

	// The rights lists say who may edit a reference, which is not a question a
	// workflow asks — and their `Date` fields would serialize to strings the wire
	// shape does not describe.
	it("serves no rights lists or build history", async () => {
		const referenceId = await seedReference(db, userId, {
			member: { build: true, modify: true },
		});

		const response = await handleGetReference(
			deps,
			get(referenceId),
			String(referenceId),
		);
		const rendered = await response.text();

		expect(rendered).not.toContain("users");
		expect(rendered).not.toContain("groups");
		expect(rendered).not.toContain("latestBuild");
		expect(rendered).not.toContain("contributors");
	});

	it("reports 404 for a reference that does not exist", async () => {
		const response = await handleGetReference(deps, get(404_040), "404040");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Reference not found" });
	});

	it("reports 404 for an id that is not a positive integer", async () => {
		const response = await handleGetReference(deps, get("latest"), "latest");

		expect(response.status).toBe(404);
	});

	it("refuses an unauthenticated request", async () => {
		const referenceId = await seedReference(db, userId);

		const response = await handleGetReference(
			deps,
			get(referenceId, false),
			String(referenceId),
		);

		expect(response.status).toBe(401);
	});
});
