import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { legacyHistory } from "@virtool/data/db/schema/history";
import { indexes, indexFiles } from "@virtool/data/db/schema/indexes";
import { jobs } from "@virtool/data/db/schema/jobs";
import { legacyOtus } from "@virtool/data/db/schema/otus";
import { legacyReferences } from "@virtool/data/db/schema/references";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedIndex, seedReference } from "@virtool/data/indexes/test/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import type { ReadHandlerDeps } from "../http";
import { handleGetIndex } from "./handlers";

let database: TestDatabase;
let db: Db;
let deps: ReadHandlerDeps;
let credential: string;
let userId: number;
let referenceId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(indexFiles);
	await db.delete(legacyHistory);
	await db.delete(indexes);
	await db.delete(legacyOtus);
	await db.delete(legacyReferences);
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db);
	referenceId = await seedReference(db, userId, { name: "Plant viruses" });

	const job = await seedJob(db, userId, { workflow: "pathoscope" });

	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	deps = { db };
});

function get(indexId: number | string, authenticated = true): Request {
	return new Request(`https://jobs.virtool.test/indexes/${indexId}`, {
		headers: authenticated ? { authorization: `Basic ${credential}` } : {},
	});
}

describe("handleGetIndex", () => {
	it("serves the build, its manifest and its files", async () => {
		const indexId = await seedIndex(db, { referenceId, userId, version: 3 });

		await db
			.update(indexes)
			.set({ manifest: { otu1: 2, otu2: 5 } })
			.where(eq(indexes.id, indexId));

		await db.insert(indexFiles).values({
			index_id: indexId,
			name: "reference.1.bt2",
			size: 2048,
			storage_key: "indexes/7/aaaabbbbccccddddeeeeffff00001111",
			type: "bowtie2",
		});

		const response = await handleGetIndex(deps, get(indexId), String(indexId));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: indexId,
			files: [
				{
					id: expect.any(Number),
					name: "reference.1.bt2",
					size: 2048,
					storageKey: "indexes/7/aaaabbbbccccddddeeeeffff00001111",
					type: "bowtie2",
				},
			],
			manifest: { otu1: 2, otu2: 5 },
			ready: true,
			reference: { id: referenceId, name: "Plant viruses" },
			version: 3,
		});
	});

	// A migrated build's objects sit under whatever prefix they were written with,
	// which no pattern reconstructs. If the handler ever composed a key rather than
	// reading the column, this is the test that fails.
	it("returns a migrated file's recorded key verbatim", async () => {
		const indexId = await seedIndex(db, { referenceId, userId, version: 0 });
		const legacyKey = "references/abc123/reference.fa.gz";

		await db.insert(indexFiles).values({
			index_id: indexId,
			name: "reference.fa.gz",
			size: 16,
			storage_key: legacyKey,
			type: "fasta",
		});

		const response = await handleGetIndex(deps, get(indexId), String(indexId));
		const index = (await response.json()) as {
			files: { storageKey: string }[];
		};

		expect(index.files[0]?.storageKey).toBe(legacyKey);
	});

	// Python's `create_index` task writes a build's artifacts eagerly. This read
	// reports what the rows say and generates nothing, so an unfinished build
	// answers with an empty file list rather than building one.
	it("reports an unfinished build without producing its files", async () => {
		const indexId = await seedIndex(db, {
			referenceId,
			userId,
			version: 1,
			ready: false,
		});

		const response = await handleGetIndex(deps, get(indexId), String(indexId));
		const index = (await response.json()) as {
			files: unknown[];
			ready: boolean;
		};

		expect(index.ready).toBe(false);
		expect(index.files).toEqual([]);
	});

	it("serves no download URL", async () => {
		const indexId = await seedIndex(db, { referenceId, userId, version: 0 });

		const response = await handleGetIndex(deps, get(indexId), String(indexId));

		expect(await response.text()).not.toContain("downloadUrl");
	});

	it("reports 404 for a build that does not exist", async () => {
		const response = await handleGetIndex(deps, get(404_040), "404040");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Index not found" });
	});

	it("reports 404 for an id that is not a positive integer", async () => {
		const response = await handleGetIndex(deps, get("latest"), "latest");

		expect(response.status).toBe(404);
	});

	it("refuses an unauthenticated request", async () => {
		const indexId = await seedIndex(db, { referenceId, userId, version: 0 });

		const response = await handleGetIndex(
			deps,
			get(indexId, false),
			String(indexId),
		);

		expect(response.status).toBe(401);
	});
});
