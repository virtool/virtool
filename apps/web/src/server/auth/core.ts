import type { User } from "@virtool/contracts";
import { updateAuthPassword } from "@virtool/data/auth/identity";
import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import {
	createSetupSession,
	invalidateSetupSession,
} from "@virtool/data/auth/setup";
import type { Db } from "@virtool/data/db/pg";
import { authSessions } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createUser,
	getUserCount,
	UserConflictError,
} from "@virtool/data/users/data";
import { and, eq, sql } from "drizzle-orm";
import type { CookieAdapter } from "./cookies";

const TIMING_DUMMY_HASH = Buffer.from(
	"$2b$12$0000000000000000000000000000000000000000000000000000O",
	"utf8",
);

/** Submitted credentials do not identify an eligible account. */
export class InvalidCredentialsError extends Error {
	constructor() {
		super("Invalid credentials");
		this.name = "InvalidCredentialsError";
	}
}

/** New password cannot match the user's current password. */
export class PasswordReuseError extends Error {
	constructor() {
		super("Cannot reuse current password");
		this.name = "PasswordReuseError";
	}
}

/** First-user setup ran but the instance already has at least one user. */
export class FirstUserExistsError extends Error {
	constructor() {
		super("Instance already has a user");
		this.name = "FirstUserExistsError";
	}
}

/** Inputs for the legacy-identity remediation bridge. */
export type LegacyRemediationInput = {
	handle: string;
	password: string;
	ip: string;
};

/**
 * Authenticate an unmigrated legacy identity and issue a purpose-bound setup
 * session. Returns false when the handle is not an eligible legacy identity so
 * the caller can continue through Better Auth's normal sign-in path.
 */
export async function beginLegacyEmailRemediation(
	db: Db,
	cookies: CookieAdapter,
	input: LegacyRemediationInput,
): Promise<boolean> {
	const [user] = await db
		.select({
			active: users.active,
			authMigratedAt: users.authMigratedAt,
			id: users.id,
			lifecycleState: users.lifecycleState,
			password: users.password,
		})
		.from(users)
		.where(sql`lower(${users.handle}) = ${input.handle.toLowerCase()}`)
		.limit(1);

	if (user && user.authMigratedAt !== null) {
		return false;
	}

	if (
		!user?.active ||
		user.lifecycleState !== "normal" ||
		user.password === null
	) {
		await verifyPassword(input.password, TIMING_DUMMY_HASH);
		throw new InvalidCredentialsError();
	}

	if (!(await verifyPassword(input.password, user.password))) {
		throw new InvalidCredentialsError();
	}

	const setup = await createSetupSession(db, {
		userId: user.id,
		purpose: "email_remediation",
		ip: input.ip,
	});
	cookies.setSetupSession(setup.sessionId, setup.token);
	return true;
}

/** Inputs to create and authenticate the first instance user. */
export type CreateFirstUserInput = {
	handle: string;
	password: string;
};

/**
 * Create the first instance user and log them in.
 *
 * The first user is always a full administrator. Creation is rejected once any
 * user exists, so the unauthenticated bootstrap endpoint can't be used to mint
 * further accounts. On success an authenticated session is written and the
 * session cookies are set, so the caller lands in the app without a separate
 * login step.
 */
export async function createFirstUser(
	db: Db,
	input: CreateFirstUserInput,
): Promise<User> {
	if ((await getUserCount(db)) > 0) {
		throw new FirstUserExistsError();
	}

	let user: User;
	try {
		user = await createUser(db, {
			handle: input.handle,
			password: input.password,
			forceReset: false,
			administratorRole: "full",
		});
	} catch (err) {
		if (err instanceof UserConflictError) {
			throw new FirstUserExistsError();
		}
		throw err;
	}

	return user;
}

/**
 * Delete the restricted setup session named by its cookie and clear setup and
 * obsolete legacy-session cookies.
 *
 * Safe to call with no session, or with a stale one: the cookies are cleared
 * either way, which is why `logoutFn` is exempt from authentication.
 *
 * Better Auth invalidation happens in `logoutFn` before this cleanup. This is
 * also the abandon path for a setup flow. A holder who walks away from
 * an invitation or an enrollment has to be able to drop the credential, and
 * doing it here means there is one way to end a browser's authority rather
 * than one per kind.
 */
export async function logout(db: Db, cookies: CookieAdapter): Promise<void> {
	const setupSessionId = cookies.getSetupSessionId();
	if (setupSessionId) {
		await invalidateSetupSession(db, setupSessionId);
	}

	cookies.clearLegacySession();
	cookies.clearSetup();
}

/** Inputs to complete a forced-reset password change. */
export type ResetPasswordInput = {
	userId: number;
	password: string;
};

/**
 * Complete a forced reset for the user identified by a restricted Better Auth
 * session. The password must differ from the current one. The transaction
 * updates both credential copies, clears `force_reset`, and revokes every
 * Better Auth session; the caller then signs in again to mint one replacement.
 */
export async function resetPassword(
	db: Db,
	input: ResetPasswordInput,
): Promise<string> {
	const [row] = await db
		.select({
			forceReset: users.forceReset,
			handle: users.handle,
			password: users.password,
		})
		.from(users)
		.where(eq(users.id, input.userId))
		.limit(1);

	if (!row?.forceReset || !row.password) {
		throw new PasswordReuseError();
	}

	const sameAsCurrent = await verifyPassword(input.password, row.password);
	if (sameAsCurrent) {
		throw new PasswordReuseError();
	}

	// Hashing is CPU-bound and slow by design, so it happens before the
	// transaction opens rather than holding one idle for the duration.
	const newHash = await hashPassword(input.password);

	await db.transaction(async (tx) => {
		const updated = await tx
			.update(users)
			.set({
				password: newHash,
				forceReset: false,
				lastPasswordChange: new Date(),
			})
			.where(
				and(
					eq(users.id, input.userId),
					eq(users.forceReset, true),
					sql`${users.password} = ${row.password}`,
				),
			)
			.returning({ id: users.id });

		if (updated.length === 0) {
			throw new PasswordReuseError();
		}

		await updateAuthPassword(tx, input.userId, newHash);
		await tx.delete(authSessions).where(eq(authSessions.userId, input.userId));
	});

	return row.handle;
}
