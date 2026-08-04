import {
	type SeededSession,
	type SeedUserOptions,
	seedSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import type { Mock } from "vitest";
import { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } from "../cookies";

/**
 * Encode a seeded session as the `Cookie` header value that authenticates it.
 *
 * Server functions are cookie-only; a raw route accepts either this or
 * {@link basicAuthHeader}.
 */
export function sessionCookie({
	sessionId,
	token,
}: Pick<SeededSession, "sessionId" | "token">): string {
	return `${SESSION_ID_COOKIE}=${sessionId}; ${SESSION_TOKEN_COOKIE}=${token}`;
}

/**
 * Open a session for an already-seeded user and point `getRequest` at a request
 * carrying its cookies.
 *
 * `getRequest` is the suite's own `vi.fn()` standing in for
 * `@tanstack/react-start/server`'s, which is why it is passed in rather than
 * reached for — the mock is installed per test file.
 */
export async function authenticateAs(
	db: Db,
	getRequest: Mock,
	userId: number,
): Promise<void> {
	const session = await seedSession(db, userId);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: { cookie: sessionCookie(session) },
		}),
	);
}

/**
 * Seed a user and authenticate the next call as them. Returns the new user's id.
 *
 * `handle` is unique case-insensitively, so a suite signing in more than one
 * user must pass a distinct one.
 */
export async function signIn(
	db: Db,
	getRequest: Mock,
	options: SeedUserOptions = {},
): Promise<number> {
	const userId = await seedUser(db, options);
	await authenticateAs(db, getRequest, userId);
	return userId;
}

/** Encode `handle` and `key` as an HTTP Basic `Authorization` header value. */
export function basicAuthHeader(handle: string, key: string): string {
	return `Basic ${Buffer.from(`${handle}:${key}`, "utf8").toString("base64")}`;
}
