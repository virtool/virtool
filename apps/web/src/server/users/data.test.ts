import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../auth/password";
import { seedSession, seedUser } from "../auth/test/fixtures";
import { hashToken } from "../auth/tokens";
import type { Db } from "../db/pg";
import { groups, userGroups } from "../db/schema/groups";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { addToGroup, seedGroup } from "../groups/test/fixtures";
import {
	changePassword,
	createUser,
	findUsers,
	GroupMembershipError,
	getAccount,
	getAdministratorRole,
	getUser,
	getUserCount,
	InvalidPasswordError,
	listAdministratorRoles,
	listUsers,
	setAdministratorRole,
	UserConflictError,
	UserNotFoundError,
	updateAccountEmail,
	updateUser,
} from "./data";

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

const settings = {
	quick_analyze_workflow: "nuvs",
	show_ids: false,
	show_versions: true,
	skip_quick_analyze_dialog: false,
};

describe("getAccount", () => {
	it("returns the email and settings that only the account holder may read", async () => {
		const userId = await seedUser(db, {
			email: "alice@example.com",
			handle: "alice",
			settings,
		});

		const account = await getAccount(db, userId);

		expect(account.email).toBe("alice@example.com");
		expect(account.settings).toEqual(settings);
	});

	it("returns the same user fields the administration views see", async () => {
		const userId = await seedUser(db, {
			administratorRole: "full",
			handle: "alice",
		});

		const account = await getAccount(db, userId);

		expect(account).toMatchObject({
			id: userId,
			handle: "alice",
			administrator_role: "full",
			active: true,
			force_reset: false,
			groups: [],
			primary_group: null,
		});
	});

	// The route guards on /login and /_authenticated read a rejection as "nobody
	// is signed in", so this must throw rather than resolve undefined.
	it("throws when the user does not exist", async () => {
		await expect(getAccount(db, 404)).rejects.toBeInstanceOf(UserNotFoundError);
	});
});

async function countSessions(userId: number): Promise<number> {
	const rows = await db
		.select({ sessionId: sessions.sessionId })
		.from(sessions)
		.where(eq(sessions.userId, userId));
	return rows.length;
}

async function readUser(userId: number) {
	const [row] = await db.select().from(users).where(eq(users.id, userId));
	return row;
}

describe("updateUser", () => {
	it("deletes the user's sessions when they are deactivated", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);
		await seedSession(db, userId);

		await updateUser(db, userId, { active: false });

		expect(await countSessions(userId)).toBe(0);
		expect((await readUser(userId))?.active).toBe(false);
	});

	it("deletes the user's sessions when their password changes", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);
		const before = await readUser(userId);

		await updateUser(db, userId, { password: "new-password-1234" });

		expect(await countSessions(userId)).toBe(0);
		const after = await readUser(userId);
		expect(
			await verifyPassword("new-password-1234", after?.password as Buffer),
		).toBe(true);
		expect(after?.lastPasswordChange.getTime()).toBeGreaterThan(
			before?.lastPasswordChange.getTime() ?? 0,
		);
	});

	it("deletes the user's sessions when force_reset is set", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);

		await updateUser(db, userId, { force_reset: true });

		expect(await countSessions(userId)).toBe(0);
		expect((await readUser(userId))?.forceReset).toBe(true);
	});

	it("leaves sessions alone when only the handle changes", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);

		await updateUser(db, userId, { handle: "renamed" });

		expect(await countSessions(userId)).toBe(1);
		expect((await readUser(userId))?.handle).toBe("renamed");
	});

	it("leaves sessions alone when only group membership changes", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);

		await updateUser(db, userId, { groups: [] });

		expect(await countSessions(userId)).toBe(1);
	});

	it("revokes only the target user's sessions", async () => {
		const alice = await seedUser(db, { handle: "alice" });
		const bob = await seedUser(db, { handle: "bob" });
		await seedSession(db, alice);
		await seedSession(db, bob);

		await updateUser(db, alice, { active: false });

		expect(await countSessions(alice)).toBe(0);
		expect(await countSessions(bob)).toBe(1);
	});

	it("rolls back the deactivation and the session deletion together on failure", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);

		// Pairing the deactivation with a primary_group the user does not belong to
		// makes the promote fail inside the same transaction, so nothing commits.
		await expect(
			updateUser(db, userId, { active: false, primary_group: 999 }),
		).rejects.toBeInstanceOf(GroupMembershipError);

		expect(await countSessions(userId)).toBe(1);
		expect((await readUser(userId))?.active).toBe(true);
	});

	it("replaces group membership, keeping the primary flag on a group that stays", async () => {
		const userId = await seedUser(db);
		const keep = await seedGroup(db, { name: "keep" });
		const drop = await seedGroup(db, { name: "drop" });
		const add = await seedGroup(db, { name: "add" });
		await updateUser(db, userId, { groups: [keep, drop], primary_group: keep });

		await updateUser(db, userId, { groups: [keep, add] });

		const memberships = await db
			.select()
			.from(userGroups)
			.where(eq(userGroups.userId, userId));
		expect(memberships.map((row) => row.groupId).sort()).toEqual(
			[keep, add].sort(),
		);
		// The primary survives because its group is still a member.
		const primary = memberships.find((row) => row.primary);
		expect(primary?.groupId).toBe(keep);
	});

	it("promotes a group the user belongs to and demotes the previous primary", async () => {
		const userId = await seedUser(db);
		const first = await seedGroup(db, { name: "first" });
		const second = await seedGroup(db, { name: "second" });
		await addToGroup(db, userId, first);
		await addToGroup(db, userId, second);

		await updateUser(db, userId, { primary_group: first });
		await updateUser(db, userId, { primary_group: second });

		const memberships = await db
			.select()
			.from(userGroups)
			.where(eq(userGroups.userId, userId));
		expect(
			memberships.filter((row) => row.primary).map((row) => row.groupId),
		).toEqual([second]);
	});

	it("clears the primary group", async () => {
		const userId = await seedUser(db);
		const groupId = await seedGroup(db);
		await addToGroup(db, userId, groupId);
		await updateUser(db, userId, { primary_group: groupId });

		await updateUser(db, userId, { primary_group: null });

		const memberships = await db
			.select()
			.from(userGroups)
			.where(eq(userGroups.userId, userId));
		expect(memberships.every((row) => !row.primary)).toBe(true);
	});

	it("rejects a primary group the user does not belong to", async () => {
		const userId = await seedUser(db);
		const groupId = await seedGroup(db);

		await expect(
			updateUser(db, userId, { primary_group: groupId }),
		).rejects.toBeInstanceOf(GroupMembershipError);
	});

	it("throws when the user does not exist", async () => {
		await expect(
			updateUser(db, 404, { handle: "ghost" }),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});
});

describe("updateAccountEmail", () => {
	it("sets the address and returns the updated account", async () => {
		const userId = await seedUser(db, { email: "" });

		const account = await updateAccountEmail(db, userId, "alice@example.com");

		expect(account.email).toBe("alice@example.com");
		expect((await readUser(userId))?.email).toBe("alice@example.com");
	});

	it("clears the address when given an empty string", async () => {
		const userId = await seedUser(db, { email: "alice@example.com" });

		const account = await updateAccountEmail(db, userId, "");

		expect(account.email).toBe("");
	});

	it("throws when the user does not exist", async () => {
		await expect(
			updateAccountEmail(db, 404, "alice@example.com"),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});
});

describe("changePassword", () => {
	async function seedUserWithPassword(password: string): Promise<number> {
		return seedUser(db, { password: await hashPassword(password) });
	}

	it("replaces the password and clears force_reset", async () => {
		const userId = await seedUserWithPassword("old_password_123");
		const before = await readUser(userId);

		await db
			.update(users)
			.set({ forceReset: true })
			.where(eq(users.id, userId));

		const { account } = await changePassword(db, {
			userId,
			oldPassword: "old_password_123",
			password: "new_password_123",
			ip: "127.0.0.1",
		});

		const after = await readUser(userId);
		expect(
			await verifyPassword("new_password_123", after?.password as Buffer),
		).toBe(true);
		expect(after?.forceReset).toBe(false);
		expect(after?.lastPasswordChange.getTime()).toBeGreaterThanOrEqual(
			before?.lastPasswordChange.getTime() ?? 0,
		);
		expect(account.id).toBe(userId);
	});

	it("revokes every existing session and returns the replacement", async () => {
		const userId = await seedUserWithPassword("old_password_123");
		const stale = await seedSession(db, userId);
		await seedSession(db, userId);

		const { sessionId, token } = await changePassword(db, {
			userId,
			oldPassword: "old_password_123",
			password: "new_password_123",
			ip: "10.0.0.1",
		});

		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));

		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionId).toBe(sessionId);
		expect(rows[0]?.sessionId).not.toBe(stale.sessionId);
		expect(rows[0]?.tokenHash).toBe(hashToken(token));
		expect(rows[0]?.sessionType).toBe("authenticated");
		expect(rows[0]?.ip).toBe("10.0.0.1");
	});

	// Python passes `remember=False`, so the replacement gets the 60-minute
	// lifetime even if the session it replaces was a 30-day one.
	it("never remembers the replacement session", async () => {
		const userId = await seedUserWithPassword("old_password_123");

		await changePassword(db, {
			userId,
			oldPassword: "old_password_123",
			password: "new_password_123",
			ip: "127.0.0.1",
		});

		const [row] = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));

		const lifetime =
			(row?.expiresAt.getTime() ?? 0) - (row?.createdAt.getTime() ?? 0);
		expect(lifetime).toBe(60 * 60 * 1000);
	});

	it("rejects a wrong old password and leaves everything alone", async () => {
		const userId = await seedUserWithPassword("old_password_123");
		await seedSession(db, userId);

		await expect(
			changePassword(db, {
				userId,
				oldPassword: "wrong_password_123",
				password: "new_password_123",
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(InvalidPasswordError);

		expect(await countSessions(userId)).toBe(1);
		expect(
			await verifyPassword(
				"old_password_123",
				(await readUser(userId))?.password as Buffer,
			),
		).toBe(true);
	});

	it("throws when the user does not exist", async () => {
		await expect(
			changePassword(db, {
				userId: 404,
				oldPassword: "old_password_123",
				password: "new_password_123",
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});

	// Nothing holds a lock across the read, the verify, and the bcrypt hash, and at
	// cost 12 that gap is hundreds of milliseconds — long enough for an
	// administrator responding to a compromise to reset the password in between.
	// The admin's hash is computed up front so the interleaving write itself is a
	// fast statement landing well inside that window.
	it("refuses when the password changed after it was verified", async () => {
		const userId = await seedUserWithPassword("old_password_123");
		await seedSession(db, userId);
		const adminHash = await hashPassword("admin_reset_123");

		const pending = changePassword(db, {
			userId,
			oldPassword: "old_password_123",
			password: "new_password_123",
			ip: "127.0.0.1",
		});

		await db
			.update(users)
			.set({ password: adminHash, forceReset: true })
			.where(eq(users.id, userId));

		await expect(pending).rejects.toBeInstanceOf(InvalidPasswordError);

		// The administrator's credential and flag survive, and the rolled-back
		// transaction took its session revocation with it.
		const after = await readUser(userId);
		expect(
			await verifyPassword("admin_reset_123", after?.password as Buffer),
		).toBe(true);
		expect(after?.forceReset).toBe(true);
		expect(await countSessions(userId)).toBe(1);
	});
});

describe("getUserCount", () => {
	it("counts every user row", async () => {
		expect(await getUserCount(db)).toBe(0);
		await seedUser(db, { handle: "alice" });
		await seedUser(db, { handle: "bob" });
		expect(await getUserCount(db)).toBe(2);
	});
});

describe("listUsers", () => {
	it("returns only active users, handle-ascending and case-insensitively", async () => {
		await seedUser(db, { handle: "Charlie" });
		await seedUser(db, { handle: "alice" });
		await seedUser(db, { handle: "bob", active: false });

		const result = await listUsers(db);

		expect(result.map((user) => user.handle)).toEqual(["alice", "Charlie"]);
	});
});

describe("findUsers", () => {
	it("filters by handle substring", async () => {
		await seedUser(db, { handle: "alice" });
		await seedUser(db, { handle: "malice" });
		await seedUser(db, { handle: "bob" });

		const result = await findUsers(db, { term: "lice" });

		expect(result.items.map((user) => user.handle)).toEqual([
			"alice",
			"malice",
		]);
		expect(result.foundCount).toBe(2);
		expect(result.totalCount).toBe(3);
	});

	it("filters to administrators and to non-administrators", async () => {
		await seedUser(db, { handle: "admin", administratorRole: "full" });
		await seedUser(db, { handle: "regular" });

		const admins = await findUsers(db, { administrator: true });
		const regulars = await findUsers(db, { administrator: false });

		expect(admins.items.map((user) => user.handle)).toEqual(["admin"]);
		expect(regulars.items.map((user) => user.handle)).toEqual(["regular"]);
	});

	it("excludes inactive users by default and includes them on request", async () => {
		await seedUser(db, { handle: "alice" });
		await seedUser(db, { handle: "bob", active: false });

		const active = await findUsers(db, {});
		const inactive = await findUsers(db, { active: false });

		expect(active.items.map((user) => user.handle)).toEqual(["alice"]);
		expect(inactive.items.map((user) => user.handle)).toEqual(["bob"]);
	});

	it("paginates and reports the page count", async () => {
		for (const handle of ["a", "b", "c"]) {
			await seedUser(db, { handle });
		}

		const page1 = await findUsers(db, { page: 1, perPage: 2 });
		const page2 = await findUsers(db, { page: 2, perPage: 2 });

		expect(page1.items.map((user) => user.handle)).toEqual(["a", "b"]);
		expect(page2.items.map((user) => user.handle)).toEqual(["c"]);
		expect(page1.pageCount).toBe(2);
	});
});

describe("getUser", () => {
	it("merges permissions across the user's groups and names the primary", async () => {
		const userId = await seedUser(db, { handle: "alice" });
		const refs = await seedGroup(db, {
			name: "refs",
			permissions: { create_ref: true },
		});
		const samples = await seedGroup(db, {
			name: "samples",
			permissions: { create_sample: true },
		});
		await addToGroup(db, userId, refs);
		await addToGroup(db, userId, samples);
		await updateUser(db, userId, { primary_group: samples });

		const user = await getUser(db, userId);

		expect(user.permissions).toMatchObject({
			create_ref: true,
			create_sample: true,
			upload_file: false,
		});
		expect(user.groups.map((group) => group.name)).toEqual(["refs", "samples"]);
		expect(user.primary_group).toMatchObject({ id: samples, name: "samples" });
	});

	it("throws when the user does not exist", async () => {
		await expect(getUser(db, 404)).rejects.toBeInstanceOf(UserNotFoundError);
	});
});

describe("createUser", () => {
	it("creates a user with the default settings and no administrator role", async () => {
		const user = await createUser(db, {
			handle: "alice",
			password: "a-real-password",
			forceReset: true,
		});

		expect(user).toMatchObject({
			handle: "alice",
			administrator_role: null,
			active: true,
			force_reset: true,
			groups: [],
			primary_group: null,
		});

		const [row] = await db.select().from(users).where(eq(users.id, user.id));
		expect(row?.settings).toEqual({
			skip_quick_analyze_dialog: true,
			show_ids: true,
			show_versions: true,
			quick_analyze_workflow: "pathoscope",
		});
		// The password is hashed, not stored verbatim.
		expect(
			await verifyPassword("a-real-password", row?.password as Buffer),
		).toBe(true);
	});

	it("rejects a duplicate handle", async () => {
		await createUser(db, {
			handle: "alice",
			password: "a-real-password",
			forceReset: false,
		});

		await expect(
			createUser(db, {
				handle: "alice",
				password: "another-password",
				forceReset: false,
			}),
		).rejects.toBeInstanceOf(UserConflictError);
	});
});

describe("setAdministratorRole", () => {
	it("assigns and clears the administrator role", async () => {
		const userId = await seedUser(db);

		const promoted = await setAdministratorRole(db, userId, "full");
		expect(promoted.administrator_role).toBe("full");

		const demoted = await setAdministratorRole(db, userId, null);
		expect(demoted.administrator_role).toBeNull();
	});

	it("throws when the user does not exist", async () => {
		await expect(setAdministratorRole(db, 404, "full")).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
	});
});

describe("getAdministratorRole", () => {
	it("returns the role, or null when there is none", async () => {
		const admin = await seedUser(db, {
			handle: "admin",
			administratorRole: "settings",
		});
		const regular = await seedUser(db, { handle: "regular" });

		expect(await getAdministratorRole(db, admin)).toBe("settings");
		expect(await getAdministratorRole(db, regular)).toBeNull();
	});
});

describe("listAdministratorRoles", () => {
	it("lists every assignable administrator role", async () => {
		const roles = listAdministratorRoles();

		expect(roles.map((role) => role.id)).toEqual([
			"full",
			"settings",
			"spaces",
			"users",
			"base",
		]);
	});
});
