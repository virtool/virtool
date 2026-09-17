import { createHmac } from "node:crypto";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts, authSessions } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const cookies = new Map<string, string>();
const getRequest = vi.fn(
	() =>
		new Request("https://virtool.test", {
			headers: {
				origin: "https://virtool.test",
				cookie: [...cookies]
					.map(([key, value]) => `${key}=${value}`)
					.join("; "),
			},
		}),
);
const setResponseStatus = vi.fn();
vi.mock("@tanstack/react-start/server", () => ({
	getRequest,
	setResponseStatus,
	getCookie: (key: string) => cookies.get(key),
	setCookie: (key: string, value: string) => {
		cookies.set(key, value);
	},
	deleteCookie: (key: string) => {
		cookies.delete(key);
	},
}));
let db: Db;
let auth: ReturnType<typeof import("./betterAuth").createAuth>;
vi.mock("../composition", () => ({
	get db() {
		return db;
	},
}));
vi.mock("./instance", () => ({
	get auth() {
		return auth;
	},
}));
const { createAuth } = await import("./betterAuth");
const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
let database: TestDatabase;
const password = "correct-horse-battery-staple";
const hash = "$2b$12$YZZHj6hv6jXthfSY0zt8oO0Sk47cjiLCTP.sQHRBYQJVJZ0ALjsxu";

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: "https://virtool.test",
		webauthnRpId: "virtool.test",
		secret: "test-auth-secret-test-auth-secret",
	});
}, 60_000);
afterAll(async () => {
	await database.drop();
});
beforeEach(async () => {
	cookies.clear();
	vi.clearAllMocks();
	await db.delete(users);
});

async function enroll(forceReset: boolean) {
	const [user] = await db
		.insert(users)
		.values({
			handle: "Alice",
			username: "alice",
			displayUsername: "Alice",
			name: "Alice",
			email: "alice@virtool.test",
			password: Buffer.from(hash),
			lastPasswordChange: new Date(),
			settings: {},
			active: true,
			lifecycleState: "normal",
			authMigratedAt: new Date(),
			forceReset,
		})
		.returning({ id: users.id });
	if (!user) {
		throw new Error("Missing seeded user");
	}
	await db.insert(authAccounts).values({
		accountId: String(user.id),
		providerId: "credential",
		userId: user.id,
		password: hash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await auth.api.signInUsername({ body: { username: "alice", password } });
	const enrollment = await auth.api.enableTwoFactor({
		headers: getRequest().headers,
		body: { password },
	});
	await auth.api.verifyTOTP({
		headers: getRequest().headers,
		body: { code: totp(enrollment.totpURI) },
	});
	await db.delete(authSessions);
	cookies.clear();
	return { ...enrollment, userId: user.id };
}

function totp(uri: string) {
	const secret = new URL(uri).searchParams.get("secret") ?? "";
	const bits = [...secret.toUpperCase()]
		.map((char) =>
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
				.indexOf(char)
				.toString(2)
				.padStart(5, "0"),
		)
		.join("");
	const key = Buffer.from(
		(bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)),
	);
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
	const digest = createHmac("sha1", key).update(counter).digest();
	const offset = (digest[digest.length - 1] ?? 0) & 15;
	return String(
		(digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
	).padStart(6, "0");
}

it.each([false, true])(
	"completes the pending TOTP challenge with forceReset=%s",
	async (forceReset) => {
		const { totpURI, userId } = await enroll(forceReset);
		expect(
			await callServerFn(handlers, "loginFn", { handle: "alice", password }),
		).toEqual({ twoFactorRedirect: true });
		expect(await db.select().from(authSessions)).toEqual([]);
		expect(
			await auth.api.getSession({ headers: getRequest().headers }),
		).toBeNull();
		expect(
			await callServerFn(handlers, "verifyTwoFactorFn", {
				code: totp(totpURI),
				recovery: false,
			}),
		).toEqual({ reset: forceReset });
		const session = await auth.api.getSession({
			headers: getRequest().headers,
		});
		expect(Number(session?.user.id)).toBe(userId);
	},
);

it("keeps invalid codes unauthenticated and permits recovery-code continuation", async () => {
	const { backupCodes, userId } = await enroll(false);
	await callServerFn(handlers, "loginFn", { handle: "alice", password });
	await expect(
		callServerFn(handlers, "verifyTwoFactorFn", {
			code: "invalid",
			recovery: false,
		}),
	).rejects.toThrow("Invalid or expired verification code");
	expect(setResponseStatus).toHaveBeenLastCalledWith(400);
	expect(await db.select().from(authSessions)).toEqual([]);
	expect(
		await callServerFn(handlers, "verifyTwoFactorFn", {
			code: backupCodes[0],
			recovery: true,
		}),
	).toEqual({ reset: false });
	expect(
		Number(
			(await auth.api.getSession({ headers: getRequest().headers }))?.user.id,
		),
	).toBe(userId);
});

it("rejects verification without a pending challenge", async () => {
	await expect(
		callServerFn(handlers, "verifyTwoFactorFn", {
			code: "123456",
			recovery: false,
		}),
	).rejects.toThrow("Invalid or expired verification code");
	expect(await db.select().from(authSessions)).toEqual([]);
});
