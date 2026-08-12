import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedUser } from "../auth/test/fixtures";
import type { Db, PgClient } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { groups, userGroups } from "../db/schema/groups";
import {
	legacyReferenceGroups,
	legacyReferences,
	legacyReferenceUsers,
} from "../db/schema/references";
import { settings } from "../db/schema/settings";
import { tasks } from "../db/schema/tasks";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { collectFrames } from "../test/frames";
import {
	addReferenceGroup,
	addReferenceUser,
	createReference,
	removeReferenceGroup,
	removeReferenceUser,
	setReferenceArchived,
	updateReference,
	updateReferenceGroup,
	updateReferenceUser,
} from "./data";

let database: TestDatabase;
let db: Db;
let client: PgClient;

let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	client = database.client;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferenceGroups);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(userGroups);
	await db.delete(groups);
	await db.delete(users);
	await db.delete(settings);

	userId = await seedUser(db);
});

async function seedReference(): Promise<number> {
	const reference = await createReference(db, {
		name: "Reference",
		description: "",
		organism: "virus",
		userId,
	});

	return reference.id;
}

async function seedGroup(): Promise<number> {
	const group = takeFirstOrThrow(
		await db
			.insert(groups)
			.values({ name: "Team", permissions: {} as never })
			.returning({ id: groups.id }),
	);

	return group.id;
}

describe("createReference", () => {
	it("publishes a create frame once the transaction has committed", async () => {
		let referenceId: number | undefined;

		const frames = await collectFrames(client, async () => {
			const reference = await createReference(db, {
				name: "Reference",
				description: "",
				organism: "virus",
				userId,
			});

			referenceId = reference.id;
		});

		expect(frames).toEqual([
			{ domain: "references", resource_id: referenceId, operation: "create" },
		]);
	});

	it("publishes nothing when the clone source is missing", async () => {
		const frames = await collectFrames(client, async () => {
			await expect(
				createReference(db, {
					name: "Clone",
					description: "",
					organism: "",
					cloneFrom: 404,
					userId,
				}),
			).rejects.toThrow();
		});

		expect(frames).toEqual([]);
	});
});

describe("updateReference", () => {
	it("publishes an update frame", async () => {
		const referenceId = await seedReference();

		const frames = await collectFrames(client, async () => {
			await updateReference(db, referenceId, { name: "Renamed" });
		});

		expect(frames).toEqual([
			{ domain: "references", resource_id: referenceId, operation: "update" },
		]);
	});

	// Nothing was written, so every connected browser would refetch the
	// reference for a change that did not happen.
	it("publishes nothing when the patch is empty", async () => {
		const referenceId = await seedReference();

		const frames = await collectFrames(client, async () => {
			await updateReference(db, referenceId, {});
		});

		expect(frames).toEqual([]);
	});
});

describe("setReferenceArchived", () => {
	it("publishes an update frame", async () => {
		const referenceId = await seedReference();

		const frames = await collectFrames(client, async () => {
			await setReferenceArchived(db, referenceId, true);
		});

		expect(frames).toEqual([
			{ domain: "references", resource_id: referenceId, operation: "update" },
		]);
	});
});

describe("membership", () => {
	it("publishes an update frame for each user change", async () => {
		const referenceId = await seedReference();
		const memberId = await seedUser(db, { handle: "bob" });

		const frames = await collectFrames(client, async () => {
			await addReferenceUser(db, referenceId, memberId, { modify: true });
			await updateReferenceUser(db, referenceId, memberId, { build: true });
			await removeReferenceUser(db, referenceId, memberId);
		});

		expect(frames).toEqual([
			{ domain: "references", resource_id: referenceId, operation: "update" },
			{ domain: "references", resource_id: referenceId, operation: "update" },
			{ domain: "references", resource_id: referenceId, operation: "update" },
		]);
	});

	it("publishes an update frame for each group change", async () => {
		const referenceId = await seedReference();
		const groupId = await seedGroup();

		const frames = await collectFrames(client, async () => {
			await addReferenceGroup(db, referenceId, groupId, { modify: true });
			await updateReferenceGroup(db, referenceId, groupId, { build: true });
			await removeReferenceGroup(db, referenceId, groupId);
		});

		expect(frames).toEqual([
			{ domain: "references", resource_id: referenceId, operation: "update" },
			{ domain: "references", resource_id: referenceId, operation: "update" },
			{ domain: "references", resource_id: referenceId, operation: "update" },
		]);
	});

	it("publishes nothing when the member does not exist", async () => {
		const referenceId = await seedReference();

		const frames = await collectFrames(client, async () => {
			await expect(removeReferenceUser(db, referenceId, 404)).rejects.toThrow();
		});

		expect(frames).toEqual([]);
	});
});
