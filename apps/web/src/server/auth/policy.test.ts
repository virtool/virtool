import { emptyPermissions, type Permissions } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { authSessions } from "@virtool/data/db/schema/auth";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	addToGroup as addToGroupImpl,
	seedGroup as seedGroupImpl,
} from "@virtool/data/groups/test/fixtures";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest: vi.fn(),
	setCookie: vi.fn(),
	setResponseStatus: vi.fn(),
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { hasPermission } = await import("./policy");
const { seedUser } = await import("@virtool/data/auth/test/fixtures");

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(userGroups);
	await db.delete(authSessions);
	await db.delete(users);
	await db.delete(groups);
});

function seedGroup(
	name: string,
	permissions: Partial<Permissions>,
): Promise<number> {
	return seedGroupImpl(db, { name, permissions });
}

function addToGroup(userId: number, groupId: number): Promise<void> {
	return addToGroupImpl(db, userId, groupId);
}

function browser(userId: number) {
	return {
		kind: "browser" as const,
		sessionId: 1,
		sessionStore: "better_auth" as const,
		userId,
	};
}

describe("hasPermission", () => {
	it("denies a user in no groups", async () => {
		const userId = await seedUser(db);

		expect(await hasPermission(browser(userId), "create_sample")).toBe(false);
	});

	it("grants a permission carried by one of the user's groups", async () => {
		const userId = await seedUser(db);
		const groupId = await seedGroup("technicians", { create_sample: true });
		await addToGroup(userId, groupId);

		expect(await hasPermission(browser(userId), "create_sample")).toBe(true);
	});

	it("denies a permission none of the user's groups carry", async () => {
		const userId = await seedUser(db);
		const groupId = await seedGroup("technicians", { create_sample: true });
		await addToGroup(userId, groupId);

		expect(await hasPermission(browser(userId), "remove_file")).toBe(false);
	});

	// Permissions are the union across a user's groups, not the intersection.
	it("unions the permissions of every group the user belongs to", async () => {
		const userId = await seedUser(db);
		const samplers = await seedGroup("samplers", { create_sample: true });
		const uploaders = await seedGroup("uploaders", { upload_file: true });
		await addToGroup(userId, samplers);
		await addToGroup(userId, uploaders);

		expect(await hasPermission(browser(userId), "create_sample")).toBe(true);
		expect(await hasPermission(browser(userId), "upload_file")).toBe(true);
	});

	// `create_ref` maps to the `base` role, so any administrator covers it even
	// with no group granting it. This mirrors the client's
	// checkAdminRoleOrPermissionsFromAccount.
	it("grants a base administrator a permission their role covers", async () => {
		const userId = await seedUser(db, { administratorRole: "base" });

		expect(await hasPermission(browser(userId), "create_ref")).toBe(true);
	});

	// `upload_file` maps to `full`, which `base` does not satisfy.
	it("denies a base administrator a permission their role does not cover", async () => {
		const userId = await seedUser(db, { administratorRole: "base" });

		expect(await hasPermission(browser(userId), "upload_file")).toBe(false);
	});

	it("grants a full administrator any permission", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });

		expect(await hasPermission(browser(userId), "upload_file")).toBe(true);
		expect(await hasPermission(browser(userId), "create_sample")).toBe(true);
	});

	it("denies a session whose user no longer exists", async () => {
		expect(await hasPermission(browser(404), "create_sample")).toBe(false);
	});

	describe("with an api key", () => {
		function keyPermissions(overrides: Partial<Permissions>): Permissions {
			return { ...emptyPermissions(), ...overrides };
		}

		it("grants a permission both the user and the key hold", async () => {
			const userId = await seedUser(db);
			const groupId = await seedGroup("uploaders", { upload_file: true });
			await addToGroup(userId, groupId);

			expect(
				await hasPermission(
					{
						kind: "api_key",
						keyId: 1,
						userId,
						permissions: keyPermissions({ upload_file: true }),
					},
					"upload_file",
				),
			).toBe(true);
		});

		it("denies a permission the user holds but the key does not", async () => {
			const userId = await seedUser(db);
			const groupId = await seedGroup("uploaders", { upload_file: true });
			await addToGroup(userId, groupId);

			expect(
				await hasPermission(
					{
						kind: "api_key",
						keyId: 1,
						userId,
						permissions: keyPermissions({ create_sample: true }),
					},
					"upload_file",
				),
			).toBe(false);
		});

		it("denies a permission the key holds but the user does not", async () => {
			const userId = await seedUser(db);

			expect(
				await hasPermission(
					{
						kind: "api_key",
						keyId: 1,
						userId,
						permissions: keyPermissions({ upload_file: true }),
					},
					"upload_file",
				),
			).toBe(false);
		});

		// API-key permissions cap an administrator's permissions because the account
		// UI offers a separate permission checkbox for each key.
		it("caps a full administrator to the key's permissions", async () => {
			const userId = await seedUser(db, { administratorRole: "full" });

			expect(
				await hasPermission(
					{
						kind: "api_key",
						keyId: 1,
						userId,
						permissions: keyPermissions({ create_sample: true }),
					},
					"upload_file",
				),
			).toBe(false);
			expect(
				await hasPermission(
					{
						kind: "api_key",
						keyId: 1,
						userId,
						permissions: keyPermissions({ upload_file: true }),
					},
					"upload_file",
				),
			).toBe(true);
		});
	});
});
