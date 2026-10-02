import { emptyPermissions } from "@virtool/contracts";
import { hashPassword } from "@virtool/data/auth/password";
import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import {
	authAccounts,
	authPasskeys,
	authSessions,
	authTwoFactors,
} from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const ORIGIN = "http://localhost";

const cookies = new Map<string, string>();
const getRequest = vi.fn(
	() =>
		new Request(`${ORIGIN}/_serverFn/test`, {
			headers: {
				origin: ORIGIN,
				cookie: [...cookies]
					.map(([key, value]) => `${key}=${value}`)
					.join("; "),
			},
		}),
);

vi.mock("@tanstack/react-start/server", () => ({
	getRequest,
	setResponseStatus: vi.fn(),
	getCookie: (key: string) => cookies.get(key),
	setCookie: (key: string, value: string, options?: { maxAge?: number }) => {
		if (options?.maxAge === 0) {
			cookies.delete(key);
		} else {
			cookies.set(key, value);
		}
	},
	deleteCookie: (key: string) => {
		cookies.delete(key);
	},
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
	setContext: vi.fn(),
}));

let db: Db;
let auth: ReturnType<typeof import("../auth/betterAuth").createAuth>;

vi.mock("../composition", () => ({
	get db() {
		return db;
	},
}));

vi.mock("../auth/instance", () => ({
	get auth() {
		return auth;
	},
}));

const { createAuth } = await import("../auth/betterAuth");
const { SESSION_FRESH_AGE_SECONDS } = await import("../auth/freshness");
const { SessionNotFreshError } = await import("../auth/policy");
const { sessionCookie } = await import("../auth/test/fixtures");
const accountHandlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;

let database: TestDatabase;
let passwordHash: string;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: ORIGIN,
		webauthnRpId: "localhost",
		secret: "test-auth-secret-test-auth-secret",
	});
	passwordHash = (await hashPassword("password")).toString("utf8");
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	cookies.clear();
	vi.clearAllMocks();
	await db.delete(users);
});

function account(name: string, data?: unknown) {
	return callServerFn(accountHandlers, name, data);
}

async function seedAccount(handle = "Alice") {
	const userId = await seedUser(db, { handle });
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: passwordHash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return userId;
}

async function signInAs(userId: number, createdAt = new Date()) {
	cookies.clear();
	const session = await seedSession(db, userId, {
		createdAt,
		expiresAt: new Date(Date.now() + 60 * 60_000),
	});
	const [name, value] = sessionCookie(session).split("=");
	cookies.set(name ?? "", value ?? "");
}

async function seedPasskey(
	userId: number,
	credentialID: string,
	createdAt: Date | null = new Date(),
	name: string | null = null,
) {
	const [row] = await db
		.insert(authPasskeys)
		.values({
			userId,
			credentialID,
			publicKey: "public-key",
			counter: 3,
			deviceType: "singleDevice",
			backedUp: false,
			aaguid: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
			createdAt,
			name,
		})
		.returning({ id: authPasskeys.id });
	return row?.id ?? 0;
}

describe("listing", () => {
	it("does not extend the session", async () => {
		const userId = await seedAccount();
		await signInAs(userId);
		const [before] = await db.select().from(authSessions);

		await account("findPasskeysFn");

		const [after] = await db.select().from(authSessions);
		expect(after?.expiresAt).toEqual(before?.expiresAt);
	});

	it("returns only the user's passkeys, oldest first, without credential material", async () => {
		const userId = await seedAccount();
		const bobId = await seedAccount("Bob");
		const newer = await seedPasskey(userId, "newer", new Date(2026, 1, 2));
		const older = await seedPasskey(userId, "older", new Date(2026, 1, 1));
		await seedPasskey(bobId, "bob");
		await signInAs(userId);

		const passkeys = (await account("findPasskeysFn")) as object[];

		expect(passkeys).toEqual([
			{
				managementId: older,
				name: "Passkey",
				createdAt: new Date(2026, 1, 1),
				multiDevice: false,
				backedUp: false,
			},
			expect.objectContaining({ managementId: newer }),
		]);
		const serialized = JSON.stringify(passkeys);
		for (const secret of ["public-key", "older", "fbfc3007", "counter"]) {
			expect(serialized).not.toContain(secret);
		}
	});

	it("shows the stored name and lists a passkey without a creation time first", async () => {
		const userId = await seedAccount();
		const named = await seedPasskey(userId, "named", new Date(), "Alice");
		const undated = await seedPasskey(userId, "undated", null);
		await signInAs(userId);

		expect(await account("findPasskeysFn")).toEqual([
			expect.objectContaining({ managementId: undated, createdAt: null }),
			expect.objectContaining({ managementId: named, name: "Alice" }),
		]);
	});
});

describe("renaming", () => {
	it("normalizes whitespace in the new name", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		const result = await account("renamePasskeyFn", {
			managementId,
			name: "  Work   laptop ",
		});

		expect(result).toMatchObject({ managementId, name: "Work laptop" });
		expect((await db.select().from(authPasskeys))[0]?.name).toBe("Work laptop");
	});

	it.each([
		["an empty name", "   "],
		["a name that is too long", "x".repeat(65)],
		["a control character", "Work\u0007"],
	])("refuses %s", async (_, name) => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		await expect(
			account("renamePasskeyFn", { managementId, name }),
		).rejects.toThrow();
	});

	it("answers another user's passkey as not found and leaves it unchanged", async () => {
		const userId = await seedAccount();
		const bobId = await seedAccount("Bob");
		const managementId = await seedPasskey(bobId, "bob");
		await signInAs(userId);

		await expect(
			account("renamePasskeyFn", { managementId, name: "Mine" }),
		).rejects.toMatchObject({ status: 404 });
		expect((await db.select().from(authPasskeys))[0]?.name).toBeNull();
	});

	it("asks for a recent authentication", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		await expect(
			account("renamePasskeyFn", { managementId, name: "Work" }),
		).rejects.toBeInstanceOf(SessionNotFreshError);
	});
});

describe("removal", () => {
	it("removes the final passkey while the password remains", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		await account("removePasskeyFn", { managementId });

		expect(await db.select().from(authPasskeys)).toEqual([]);
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("leaves every other credential and the current session in place", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		const kept = await seedPasskey(userId, "kept");
		await db.insert(authTwoFactors).values({
			userId,
			secret: "secret",
			backupCodes: "codes",
		});
		await db.insert(apiKeys).values({
			hashed: "hash",
			name: "Robot",
			userId,
			permissions: emptyPermissions(),
			createdAt: new Date(),
		});
		await signInAs(userId);

		await account("removePasskeyFn", { managementId });

		expect((await db.select().from(authPasskeys)).map(({ id }) => id)).toEqual([
			kept,
		]);
		expect(await db.select().from(authTwoFactors)).toHaveLength(1);
		expect(await db.select().from(apiKeys)).toHaveLength(1);
		expect(await db.select().from(authSessions)).toHaveLength(1);
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("answers another user's passkey as not found and leaves it in place", async () => {
		const userId = await seedAccount();
		const bobId = await seedAccount("Bob");
		const managementId = await seedPasskey(bobId, "bob");
		await signInAs(userId);

		await expect(
			account("removePasskeyFn", { managementId }),
		).rejects.toMatchObject({ status: 404, message: "Passkey not found." });
		expect(await db.select().from(authPasskeys)).toHaveLength(1);
	});

	it("answers a passkey that is already gone as not found", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		await expect(account("removePasskeyFn", { managementId })).resolves.toBe(
			null,
		);
		await expect(
			account("removePasskeyFn", { managementId }),
		).rejects.toMatchObject({ status: 404, message: "Passkey not found." });
	});

	it("asks for a recent authentication", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		await expect(
			account("removePasskeyFn", { managementId }),
		).rejects.toBeInstanceOf(SessionNotFreshError);
		expect(await db.select().from(authPasskeys)).toHaveLength(1);
	});
});
