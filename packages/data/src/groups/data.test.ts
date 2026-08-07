import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { groups, userGroups } from "../db/schema/groups";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createGroup,
	deleteGroup,
	findGroups,
	GroupConflictError,
	GroupNotFoundError,
	getGroup,
	listGroups,
	updateGroup,
} from "./data";
import { addToGroup, NO_PERMISSIONS, seedGroup } from "./test/fixtures";

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
	await db.delete(users);
	await db.delete(groups);
});

async function readGroup(groupId: number) {
	const [row] = await db.select().from(groups).where(eq(groups.id, groupId));
	return row;
}

describe("listGroups", () => {
	it("returns every group, name-ascending", async () => {
		await seedGroup(db, { name: "technicians" });
		await seedGroup(db, { name: "admins" });
		await seedGroup(db, { name: "guests" });

		const result = await listGroups(db);

		expect(result.map((group) => group.name)).toEqual([
			"admins",
			"guests",
			"technicians",
		]);
	});

	it("returns the minimal shape without permissions or users", async () => {
		const groupId = await seedGroup(db, { name: "technicians" });

		const [group] = await listGroups(db);

		expect(group).toEqual({
			id: groupId,
			legacyId: null,
			name: "technicians",
		});
	});
});

describe("findGroups", () => {
	it("matches names case-insensitively and reports found and total counts", async () => {
		await seedGroup(db, { name: "Technicians" });
		await seedGroup(db, { name: "Administrators" });

		const result = await findGroups(db, "tech", 1, 25);

		expect(result.items.map((group) => group.name)).toEqual(["Technicians"]);
		expect(result.foundCount).toBe(1);
		expect(result.totalCount).toBe(2);
	});

	it("paginates the matches", async () => {
		for (const letter of ["a", "b", "c"]) {
			await seedGroup(db, { name: `group-${letter}` });
		}

		const page1 = await findGroups(db, "", 1, 2);
		const page2 = await findGroups(db, "", 2, 2);

		expect(page1.items.map((group) => group.name)).toEqual([
			"group-a",
			"group-b",
		]);
		expect(page2.items.map((group) => group.name)).toEqual(["group-c"]);
		expect(page1.pageCount).toBe(2);
		expect(page1.perPage).toBe(2);
	});
});

describe("getGroup", () => {
	it("returns the group with its permissions and member users", async () => {
		const groupId = await seedGroup(db, {
			name: "technicians",
			permissions: { create_ref: true },
		});
		const bob = await seedUser(db, { handle: "bob" });
		const alice = await seedUser(db, { handle: "alice" });
		await addToGroup(db, bob, groupId);
		await addToGroup(db, alice, groupId);

		const group = await getGroup(db, groupId);

		expect(group).toMatchObject({
			id: groupId,
			legacyId: null,
			name: "technicians",
			permissions: { ...NO_PERMISSIONS, create_ref: true },
		});
		// Members come back handle-ascending.
		expect(group.users).toEqual([
			{ id: alice, handle: "alice" },
			{ id: bob, handle: "bob" },
		]);
	});

	it("throws when the group does not exist", async () => {
		await expect(getGroup(db, 404)).rejects.toBeInstanceOf(GroupNotFoundError);
	});
});

describe("createGroup", () => {
	it("creates a group granting nothing", async () => {
		const group = await createGroup(db, "technicians");

		expect(group).toMatchObject({
			name: "technicians",
			legacyId: null,
			permissions: NO_PERMISSIONS,
			users: [],
		});
		expect((await readGroup(group.id))?.name).toBe("technicians");
	});

	it("rejects a duplicate name", async () => {
		await createGroup(db, "technicians");

		await expect(createGroup(db, "technicians")).rejects.toBeInstanceOf(
			GroupConflictError,
		);
	});
});

describe("updateGroup", () => {
	it("renames the group", async () => {
		const groupId = await seedGroup(db, { name: "technicians" });

		const group = await updateGroup(db, groupId, { name: "renamed" });

		expect(group.name).toBe("renamed");
		expect((await readGroup(groupId))?.name).toBe("renamed");
	});

	// A group's permissions are unioned into every member's, so a partial update
	// must leave the permissions it doesn't mention untouched. Overwriting the
	// whole set would silently strip grants the members already relied on.
	it("merges a partial permission update, preserving the others", async () => {
		const groupId = await seedGroup(db, {
			permissions: { create_ref: true, upload_file: true },
		});

		const group = await updateGroup(db, groupId, {
			permissions: { create_sample: true, upload_file: false },
		});

		expect(group.permissions).toEqual({
			...NO_PERMISSIONS,
			create_ref: true,
			create_sample: true,
			upload_file: false,
		});
		expect((await readGroup(groupId))?.permissions).toEqual(group.permissions);
	});

	it("returns the current group unchanged when given nothing to change", async () => {
		const groupId = await seedGroup(db, {
			name: "technicians",
			permissions: { create_ref: true },
		});

		const group = await updateGroup(db, groupId, {});

		expect(group.name).toBe("technicians");
		expect(group.permissions).toEqual({ ...NO_PERMISSIONS, create_ref: true });
	});

	it("rejects a rename that collides with another group", async () => {
		await seedGroup(db, { name: "technicians" });
		const groupId = await seedGroup(db, { name: "admins" });

		await expect(
			updateGroup(db, groupId, { name: "technicians" }),
		).rejects.toBeInstanceOf(GroupConflictError);
	});

	it("throws when the group does not exist", async () => {
		await expect(
			updateGroup(db, 404, { name: "renamed" }),
		).rejects.toBeInstanceOf(GroupNotFoundError);
	});
});

describe("deleteGroup", () => {
	it("deletes the group and its membership rows", async () => {
		const groupId = await seedGroup(db);
		const userId = await seedUser(db);
		await addToGroup(db, userId, groupId);

		await deleteGroup(db, groupId);

		expect(await readGroup(groupId)).toBeUndefined();
		expect(
			await db.select().from(userGroups).where(eq(userGroups.groupId, groupId)),
		).toHaveLength(0);
		// The user itself survives; only the membership is gone.
		expect(
			await db.select().from(users).where(eq(users.id, userId)),
		).toHaveLength(1);
	});

	it("throws when the group does not exist", async () => {
		await expect(deleteGroup(db, 404)).rejects.toBeInstanceOf(
			GroupNotFoundError,
		);
	});
});
