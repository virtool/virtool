import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@virtool/data/db/pg";
import { authRateLimits } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import { createRateLimitStorage } from "./rateLimitStorage";

const LOGIN_KEY_PREFIX = "virtool:login:";

// Matches Better Auth's own `/sign-in` rule.
const REQUESTER_RULE = { window: 10, max: 3 };
const TARGET_RULE = { window: 900, max: 10 };
const DEVICE_RULE = { window: 900, max: 5 };

// Better Auth also shares one bucket between callers whose IP it cannot resolve.
const UNRESOLVED_IP = "no-trusted-ip";

/** How long a browser keeps its own budget for an account after signing in. */
export const LOGIN_DEVICE_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

// Bounds the cookie size for a browser shared by several accounts.
const MAX_LOGIN_DEVICES = 5;

const storages = new WeakMap<Db, ReturnType<typeof createRateLimitStorage>>();

/** Thrown when a password sign-in exceeds its requester or account budget. */
export class LoginRateLimitedError extends Error {
	readonly retryAfter: number;

	constructor(retryAfter: number) {
		super("Too many sign-in attempts");
		this.retryAfter = retryAfter;
	}
}

/** The account budget that an allowed sign-in attempt spent. */
export type LoginBudget = {
	key: string;
};

/** What a password sign-in attempt is counted against. */
export type LoginAttempt = {
	ip: string;
	handle: string;
	devices: string | undefined;
	secret: string;
};

type LoginDevice = {
	userId: number;
	expiresAt: number;
	mac: string;
	raw: string;
};

function getStorage(db: Db) {
	let storage = storages.get(db);
	if (!storage) {
		storage = createRateLimitStorage(db);
		storages.set(db, storage);
	}
	return storage;
}

function normalizeHandle(handle: string): string {
	return handle.trim().toLowerCase();
}

function digest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function getTargetKey(handle: string): string {
	return `${LOGIN_KEY_PREFIX}handle:${digest(normalizeHandle(handle))}`;
}

function signLoginDevice(
	secret: string,
	userId: number,
	expiresAt: number,
	lastPasswordChange: Date,
): string {
	return createHmac("sha256", secret)
		.update(
			`login-device:${userId}:${expiresAt}:${lastPasswordChange.getTime()}`,
		)
		.digest("base64url");
}

function parseLoginDevices(value: string | undefined): LoginDevice[] {
	if (!value) {
		return [];
	}

	return value
		.split("~")
		.slice(0, MAX_LOGIN_DEVICES)
		.flatMap((raw) => {
			const [userId, expiresAt, mac, ...rest] = raw.split(".");
			const device = {
				userId: Number(userId),
				expiresAt: Number(expiresAt),
				mac: mac ?? "",
				raw,
			};
			if (
				rest.length > 0 ||
				!Number.isSafeInteger(device.userId) ||
				!Number.isSafeInteger(device.expiresAt) ||
				!device.mac
			) {
				return [];
			}
			return [device];
		});
}

async function findUser(db: Db, handle: string) {
	const [user] = await db
		.select({ id: users.id, lastPasswordChange: users.lastPasswordChange })
		.from(users)
		.where(sql`lower(${users.handle}) = ${normalizeHandle(handle)}`)
		.limit(1);

	return user;
}

/**
 * Find a device the browser holds for the handle's account. A password change
 * invalidates every device issued before it.
 */
async function findLoginDevice(
	db: Db,
	attempt: LoginAttempt,
): Promise<LoginDevice | undefined> {
	const devices = parseLoginDevices(attempt.devices);
	if (devices.length === 0) {
		return undefined;
	}

	const user = await findUser(db, attempt.handle);
	if (!user) {
		return undefined;
	}

	const now = Date.now();
	return devices.find((device) => {
		if (device.userId !== user.id || device.expiresAt <= now) {
			return false;
		}
		const expected = Buffer.from(
			signLoginDevice(
				attempt.secret,
				device.userId,
				device.expiresAt,
				user.lastPasswordChange,
			),
		);
		const provided = Buffer.from(device.mac);
		return (
			expected.length === provided.length && timingSafeEqual(expected, provided)
		);
	});
}

/**
 * Spend one attempt from the requester budget, then the account budget, before
 * any password is checked.
 *
 * The account budget is spent only once the requester budget allows the
 * attempt, so a blocked address can't drain other accounts' budgets. A browser
 * that signed in to the account before spends its own device budget instead of
 * the shared one, so failures from elsewhere can't lock it out.
 *
 * Every allowed attempt is counted so concurrent guesses can't overrun the
 * budget; {@link clearLoginFailures} gives it back once a password is correct,
 * so only failures accumulate.
 */
export async function checkLoginBudget(
	db: Db,
	attempt: LoginAttempt,
): Promise<LoginBudget> {
	const storage = getStorage(db);
	const requester = await storage.consume(
		`${LOGIN_KEY_PREFIX}ip:${attempt.ip || UNRESOLVED_IP}`,
		REQUESTER_RULE,
	);
	if (!requester.allowed) {
		throw new LoginRateLimitedError(Math.max(1, requester.retryAfter ?? 1));
	}

	const device = await findLoginDevice(db, attempt);
	const budget = device
		? { key: `${LOGIN_KEY_PREFIX}device:${digest(device.raw)}` }
		: { key: getTargetKey(attempt.handle) };

	const result = await storage.consume(
		budget.key,
		device ? DEVICE_RULE : TARGET_RULE,
	);
	if (!result.allowed) {
		throw new LoginRateLimitedError(Math.max(1, result.retryAfter ?? 1));
	}

	return budget;
}

/**
 * Reset the account budget an attempt spent after a correct password.
 *
 * The session already exists when this runs, so a failure is logged rather
 * than reported as a failed sign-in.
 */
export async function clearLoginFailures(
	db: Db,
	budget: LoginBudget,
): Promise<void> {
	try {
		await db.delete(authRateLimits).where(eq(authRateLimits.key, budget.key));
	} catch (err) {
		logger.warn({ err }, "could not clear login failures");
	}
}

/**
 * Add or renew the browser's device for the handle's account after a correct
 * password, and return the new cookie value.
 *
 * Returns `undefined` when the device can't be issued. The session already
 * exists, so a failure is logged rather than reported as a failed sign-in.
 */
export async function rememberLoginDevice(
	db: Db,
	attempt: Pick<LoginAttempt, "handle" | "devices" | "secret">,
): Promise<string | undefined> {
	try {
		const user = await findUser(db, attempt.handle);
		if (!user) {
			return undefined;
		}

		const now = Date.now();
		const expiresAt = now + LOGIN_DEVICE_LIFETIME_SECONDS * 1000;
		const issued = `${user.id}.${expiresAt}.${signLoginDevice(
			attempt.secret,
			user.id,
			expiresAt,
			user.lastPasswordChange,
		)}`;
		const kept = parseLoginDevices(attempt.devices)
			.filter((device) => device.userId !== user.id && device.expiresAt > now)
			.map((device) => device.raw);

		return [issued, ...kept].slice(0, MAX_LOGIN_DEVICES).join("~");
	} catch (err) {
		logger.warn({ err }, "could not remember login device");
		return undefined;
	}
}
