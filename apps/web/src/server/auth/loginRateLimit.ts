import { createHash } from "node:crypto";
import type { Db } from "@virtool/data/db/pg";
import { authRateLimits } from "@virtool/data/db/schema/auth";
import { eq } from "drizzle-orm";
import { createRateLimitStorage } from "./rateLimitStorage";

const LOGIN_KEY_PREFIX = "virtool:login:";

// Matches Better Auth's own `/sign-in` rule.
const REQUESTER_RULE = { window: 10, max: 3 };
const TARGET_RULE = { window: 900, max: 10 };

// Better Auth also shares one bucket between callers whose IP it cannot resolve.
const UNRESOLVED_IP = "no-trusted-ip";

const storages = new WeakMap<Db, ReturnType<typeof createRateLimitStorage>>();

/** Thrown when a password sign-in exceeds its requester or account budget. */
export class LoginRateLimitedError extends Error {
	readonly retryAfter: number;

	constructor(retryAfter: number) {
		super("Too many sign-in attempts");
		this.retryAfter = retryAfter;
	}
}

function getStorage(db: Db) {
	let storage = storages.get(db);
	if (!storage) {
		storage = createRateLimitStorage(db);
		storages.set(db, storage);
	}
	return storage;
}

function getTargetKey(handle: string): string {
	const digest = createHash("sha256")
		.update(handle.trim().toLowerCase())
		.digest("hex");
	return `${LOGIN_KEY_PREFIX}handle:${digest}`;
}

/**
 * Spend one attempt from the requester and account budgets before any password
 * is checked.
 *
 * Every attempt is counted for the account so concurrent guesses can't overrun
 * it; {@link clearLoginFailures} gives the budget back once a password is
 * correct, so only failures accumulate.
 */
export async function checkLoginBudget(
	db: Db,
	ip: string,
	handle: string,
): Promise<void> {
	const storage = getStorage(db);
	const results = await Promise.all([
		storage.consume(
			`${LOGIN_KEY_PREFIX}ip:${ip || UNRESOLVED_IP}`,
			REQUESTER_RULE,
		),
		storage.consume(getTargetKey(handle), TARGET_RULE),
	]);

	const blocked = results.filter((result) => !result.allowed);
	if (blocked.length > 0) {
		throw new LoginRateLimitedError(
			Math.max(1, ...blocked.map((result) => result.retryAfter ?? 1)),
		);
	}
}

/** Reset the account budget after a correct password. */
export async function clearLoginFailures(
	db: Db,
	handle: string,
): Promise<void> {
	await db
		.delete(authRateLimits)
		.where(eq(authRateLimits.key, getTargetKey(handle)));
}
