import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { referenceRoots } from "../db/schema/referencesV2";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createReferenceV2,
	ReferenceV2NotWritableError,
	ReferenceV2VersionConflictError,
	setReferenceV2Archived,
	updateReferenceV2,
} from "./data";

let database: TestDatabase;
let db: Db;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	userId = await seedUser(db);
}, 60_000);

afterAll(async () => {
	await database.drop();
});

describe("updateReferenceV2", () => {
	it("updates metadata once at the observed version and preserves the new values", async () => {
		const reference = await createReferenceV2(db, {
			name: "First",
			description: "",
			defaultSegmentLengthTolerance: 0.05,
			userId,
		});
		const update = {
			name: "Second",
			description: "Updated",
			defaultSegmentLengthTolerance: 0.1,
			expectedVersion: reference.version,
		};
		const updated = await updateReferenceV2(db, reference.id, update);
		expect(updated).toMatchObject({
			name: "Second",
			description: "Updated",
			defaultSegmentLengthTolerance: 0.1,
			version: 2,
		});
		await expect(
			updateReferenceV2(db, reference.id, update),
		).rejects.toBeInstanceOf(ReferenceV2VersionConflictError);
	});

	it("rejects an edit after archive and one on a remote Reference", async () => {
		const reference = await createReferenceV2(db, {
			name: "Local",
			description: "",
			defaultSegmentLengthTolerance: 0.05,
			userId,
		});
		const archived = await setReferenceV2Archived(db, reference.id, true);
		await expect(
			updateReferenceV2(db, reference.id, {
				name: "Changed",
				description: "",
				defaultSegmentLengthTolerance: 0.05,
				expectedVersion: archived.version,
			}),
		).rejects.toBeInstanceOf(ReferenceV2NotWritableError);
		const now = new Date();
		const remoteId = randomUUID();
		await db.insert(referenceRoots).values({
			id: remoteId,
			name: "Remote",
			description: "",
			kind: "remote",
			remoteUrl: "https://example.test/reference",
			defaultSegmentLengthTolerance: 0.05,
			archived: false,
			createdAt: now,
			updatedAt: now,
		});
		await expect(
			updateReferenceV2(db, remoteId, {
				name: "Changed",
				description: "",
				defaultSegmentLengthTolerance: 0.05,
				expectedVersion: 1,
			}),
		).rejects.toBeInstanceOf(ReferenceV2NotWritableError);
	});
});
