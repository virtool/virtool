import { randomBytes } from "node:crypto";

import {
	type AdministratorRoleName,
	emptyPermissions,
	type Permissions,
} from "@virtool/contracts";

import type { Db } from "../../db/pg";
import { apiKeys } from "../../db/schema/apiKeys";
import { sessions } from "../../db/schema/sessions";
import { users } from "../../db/schema/users";
import { hashToken, newSessionId, newSessionToken } from "../tokens";

/** What {@link seedUser} accepts. */
export type SeedUserOptions = {
	active?: boolean;
	administratorRole?: AdministratorRoleName | null;
	email?: string;
	forceReset?: boolean;
	handle?: string;
	password?: Buffer;
	settings?: Record<string, unknown>;
};

/** A seeded session and the plaintext token that authenticates it. */
export type SeededSession = {
	sessionId: string;
	token: string;
	userId: number;
};

/**
 * Insert a user, active and with no administrator role unless told otherwise,
 * and return its id.
 *
 * `handle` is unique (case-insensitively), so a test seeding a second user must
 * pass a distinct one.
 *
 * `password` defaults to a placeholder that is not a real bcrypt hash. A test
 * that exercises a code path which verifies the stored password must pass a
 * hash from `hashPassword`.
 */
export async function seedUser(
	db: Db,
	{
		active = true,
		administratorRole = null,
		email = "",
		forceReset = false,
		handle = "alice",
		password = Buffer.from("not-a-real-hash"),
		settings = {},
	}: SeedUserOptions = {},
): Promise<number> {
	const [user] = await db
		.insert(users)
		.values({
			active,
			administratorRole,
			email,
			forceReset,
			handle,
			lastPasswordChange: new Date(),
			password,
			settings,
		})
		.returning({ id: users.id });

	if (!user) {
		throw new Error("failed to seed user");
	}

	return user.id;
}

/**
 * Insert a session for `userId`. Only the token's hash is stored, so the
 * plaintext is returned — it is the only way a caller can authenticate as this
 * session afterwards.
 */
export async function seedSession(
	db: Db,
	userId: number,
	{
		expiresAt = new Date(Date.now() + 60_000),
		sessionType = "authenticated" as const,
		withToken = true,
	}: {
		expiresAt?: Date;
		sessionType?: "anonymous" | "authenticated" | "reset";
		withToken?: boolean;
	} = {},
): Promise<SeededSession> {
	const sessionId = newSessionId();
	const token = newSessionToken();

	await db.insert(sessions).values({
		createdAt: new Date(),
		expiresAt,
		ip: "127.0.0.1",
		sessionId,
		sessionType,
		tokenHash: withToken ? hashToken(token) : null,
		userId,
	});

	return { sessionId, token, userId };
}

/**
 * Insert an API key for `userId` and return the raw secret. Only its hash is
 * stored, so the plaintext is the only way a caller can authenticate with it
 * afterwards.
 *
 * `permissions` is merged over an all-`false` set, so a test names only the
 * permissions the key grants.
 */
export async function seedApiKey(
	db: Db,
	userId: number,
	permissions: Partial<Permissions> = {},
): Promise<string> {
	const key = randomBytes(32).toString("hex");

	await db.insert(apiKeys).values({
		createdAt: new Date(),
		hashed: hashToken(key),
		name: "test",
		permissions: { ...emptyPermissions(), ...permissions },
		userId,
	});

	return key;
}
