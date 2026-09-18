import { createHmac } from "node:crypto";
import { seedSetupSession, seedUser } from "@virtool/data/auth/test/fixtures";
import { createKeyring } from "@virtool/data/crypto/keyring";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts, authSessions } from "@virtool/data/db/schema/auth";
import { emailOutbox } from "@virtool/data/db/schema/emailOutbox";
import { settings } from "@virtool/data/db/schema/settings";
import { setupSessions } from "@virtool/data/db/schema/setup";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedSettings } from "@virtool/data/settings/test/fixtures";
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
const keyring = createKeyring(
	Buffer.alloc(32, 1).toString("base64"),
	undefined,
);
let auth: ReturnType<typeof import("./betterAuth").createAuth>;
vi.mock("../composition", () => ({
	get db() {
		return db;
	},
	get keyring() {
		return keyring;
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
	await db.delete(emailOutbox);
	await db.delete(settings);
	await db.delete(users);
});

it("completes offline remediation with an unverified email and one session", async () => {
	const userId = await seedUser(db, {
		email: "",
		handle: "Alice",
		password: Buffer.from(hash),
	});

	expect(
		await callServerFn(handlers, "loginFn", {
			handle: "alice",
			password,
		}),
	).toEqual({ remediation: true, reset: false });
	expect(await db.select().from(setupSessions)).toHaveLength(1);

	expect(
		await callServerFn(handlers, "submitEmailRemediationFn", {
			email: " Alice@Example.com ",
		}),
	).toEqual({ complete: true });

	const [user] = await db.select().from(users);
	expect(user).toMatchObject({
		id: userId,
		email: "alice@example.com",
		emailVerified: false,
	});
	expect(user?.authMigratedAt).toBeInstanceOf(Date);
	expect(await db.select().from(authAccounts)).toHaveLength(1);
	expect(await db.select().from(authSessions)).toHaveLength(1);
	expect(await db.select().from(setupSessions)).toHaveLength(0);
	expect(
		Number(
			(await auth.api.getSession({ headers: getRequest().headers }))?.user.id,
		),
	).toBe(userId);
});

it("requires the emailed token before marking a remediated email verified", async () => {
	const userId = await seedUser(db, {
		email: "",
		handle: "Alice",
		password: Buffer.from(hash),
	});
	const encrypted = keyring.encrypt("resend_api_key", "re_secret");
	if (!encrypted.ok) {
		throw new Error("expected a ready keyring");
	}
	await seedSettings(db, {
		emailApiKey: encrypted.value,
		emailEnabled: true,
		emailSenderAddress: "noreply@virtool.test",
	});
	const setup = await seedSetupSession(db, userId, "email_remediation");
	cookies.set("setup_session_id", setup.sessionId);
	cookies.set("setup_session_token", setup.token);

	expect(
		await callServerFn(handlers, "submitEmailRemediationFn", {
			email: "alice@example.com",
		}),
	).toEqual({ complete: false });

	const [queued] = await db.select().from(emailOutbox);
	if (queued?.template.type !== "email_verification") {
		throw new Error("expected an email verification message");
	}
	const token = new URL(queued.template.verifyUrl).searchParams.get("token");
	if (!token) {
		throw new Error("expected a verification token");
	}
	expect((await db.select().from(users))[0]?.emailVerified).toBe(false);
	expect(await db.select().from(authAccounts)).toHaveLength(0);

	expect(
		await callServerFn(handlers, "completeEmailRemediationFn", { token }),
	).toEqual({ complete: true });

	const [user] = await db.select().from(users);
	expect(user?.emailVerified).toBe(true);
	expect(user?.authMigratedAt).toBeInstanceOf(Date);
	expect(await db.select().from(authSessions)).toHaveLength(1);
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
