import { randomBytes } from "node:crypto";

import {
	type AccountLifecycleState,
	type AdministratorRoleName,
	emptyPermissions,
	type Permissions,
	type SetupPurpose,
} from "@virtool/contracts";

import type { Db } from "../../db/pg";
import { apiKeys } from "../../db/schema/apiKeys";
import { authSessions } from "../../db/schema/auth";
import { sessions } from "../../db/schema/sessions";
import { setupSessions, setupTokens } from "../../db/schema/setup";
import { users } from "../../db/schema/users";
import { hashToken, newSessionId, newSessionToken } from "../tokens";

/** What {@link seedUser} accepts. */
export type SeedUserOptions = {
	active?: boolean;
	administratorRole?: AdministratorRoleName | null;
	authMigratedAt?: Date | null;
	email?: string;
	forceReset?: boolean;
	handle?: string;
	lifecycleState?: AccountLifecycleState;
	password?: Buffer | null;
	settings?: Record<string, unknown>;
};

/** A seeded session and the plaintext token that authenticates it. */
export type SeededSession = {
	sessionId: number;
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
 * `password` defaults to a placeholder that is not a real password hash. A test
 * that exercises a code path which verifies the stored password must pass a
 * hash from `hashPassword`.
 *
 * `lifecycleState: "pending"` forces `password` to null, because the
 * `pending_has_no_password` constraint refuses the pair — a pending account is
 * one that has no credential at all.
 */
export async function seedUser(
	db: Db,
	{
		active = true,
		administratorRole = null,
		authMigratedAt = null,
		email = "",
		forceReset = false,
		handle = "alice",
		lifecycleState = "normal",
		password = Buffer.from("not-a-real-hash"),
		settings = {},
	}: SeedUserOptions = {},
): Promise<number> {
	const [user] = await db
		.insert(users)
		.values({
			active,
			administratorRole,
			authMigratedAt,
			email,
			forceReset,
			handle,
			lastPasswordChange: new Date(),
			lifecycleState,
			password: lifecycleState === "pending" ? null : password,
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
		createdAt = new Date(),
		expiresAt = new Date(Date.now() + 60_000),
		ipAddress = "127.0.0.1",
		updatedAt = new Date(),
		userAgent = "Test Browser/1.0",
	}: {
		createdAt?: Date;
		expiresAt?: Date;
		ipAddress?: string | null;
		updatedAt?: Date;
		userAgent?: string | null;
	} = {},
): Promise<SeededSession> {
	const token = newSessionToken();

	const [session] = await db
		.insert(authSessions)
		.values({
			createdAt,
			expiresAt,
			ipAddress,
			token,
			updatedAt,
			userAgent,
			userId,
		})
		.returning({ id: authSessions.id });

	if (!session) {
		throw new Error("failed to seed session");
	}

	return { sessionId: session.id, token, userId };
}

/** A live row of the retired legacy session store and its cookie values. */
export type SeededLegacySession = {
	sessionId: string;
	token: string;
};

/**
 * Insert a live row into the retired legacy `sessions` store, as a release from
 * before the cutover would have left it, so a test can prove nothing accepts it.
 */
export async function seedLegacySession(
	db: Db,
	userId: number,
	sessionType: "authenticated" | "reset" = "authenticated",
): Promise<SeededLegacySession> {
	const sessionId = newSessionId();
	const token = newSessionToken();
	const now = new Date();

	await db.insert(sessions).values({
		sessionId,
		userId,
		ip: "127.0.0.1",
		createdAt: now,
		expiresAt: new Date(now.getTime() + 60 * 60_000),
		tokenHash: hashToken(token),
		sessionType,
	});

	return { sessionId, token };
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

/** A seeded setup token and the plaintext that spends it. */
export type SeededSetupToken = {
	token: string;
	userId: number;
};

/**
 * Insert a setup token for `userId`. Only its digest is stored, so the
 * plaintext is returned — it is the only way a caller can spend it afterwards.
 */
export async function seedSetupToken(
	db: Db,
	userId: number,
	purpose: SetupPurpose,
	{
		candidateEmail,
		expiresAt = new Date(Date.now() + 60_000),
		consumedAt = null,
		supersededAt = null,
	}: {
		candidateEmail?: string;
		expiresAt?: Date;
		consumedAt?: Date | null;
		supersededAt?: Date | null;
	} = {},
): Promise<SeededSetupToken> {
	const token = randomBytes(32).toString("hex");

	await db.insert(setupTokens).values({
		candidateEmail,
		consumedAt,
		expiresAt,
		purpose,
		issuerUserId: purpose === "account_completion" ? userId : undefined,
		delivery: purpose === "account_completion" ? "queued" : undefined,
		supersededAt,
		tokenHash: hashToken(token),
		userId,
	});

	return { token, userId };
}

/** A seeded restricted setup session and the secret that proves it. */
export type SeededSetupSession = {
	sessionId: string;
	token: string;
	userId: number;
};

/**
 * Insert a restricted setup session for `userId`. Only the secret's digest is
 * stored, so the plaintext is returned.
 */
export async function seedSetupSession(
	db: Db,
	userId: number,
	purpose: SetupPurpose,
	{ expiresAt = new Date(Date.now() + 60_000) }: { expiresAt?: Date } = {},
): Promise<SeededSetupSession> {
	const sessionId = `setup_${randomBytes(24).toString("hex")}`;
	const token = randomBytes(32).toString("hex");

	await db.insert(setupSessions).values({
		expiresAt,
		ip: "127.0.0.1",
		purpose,
		sessionId,
		tokenHash: hashToken(token),
		userId,
	});

	return { sessionId, token, userId };
}
