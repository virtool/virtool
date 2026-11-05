import { isValidHandle, type User } from "@virtool/contracts";
import {
	isPasswordHash,
	TIMING_DUMMY_HASH,
	verifyPassword,
} from "@virtool/data/auth/password";
import {
	createSetupSession,
	invalidateSetupSession,
} from "@virtool/data/auth/setup";
import type { Keyring } from "@virtool/data/crypto/keyring";
import type { Db } from "@virtool/data/db/pg";
import { users } from "@virtool/data/db/schema/users";
import {
	createFirstAdministrator,
	FirstAdministratorExistsError,
} from "@virtool/data/users/data";
import { sql } from "drizzle-orm";
import type { CookieAdapter } from "./cookies";

/** Submitted credentials do not identify an eligible account. */
export class InvalidCredentialsError extends Error {
	constructor() {
		super("Invalid credentials");
		this.name = "InvalidCredentialsError";
	}
}

/** First-user setup ran but the instance already has at least one user. */
export class FirstUserExistsError extends Error {
	constructor() {
		super("Instance already has a user");
		this.name = "FirstUserExistsError";
	}
}

/** Inputs for the unmigrated-identity password check. */
export type LegacyLoginInput = {
	handle: string;
	password: string;
	ip: string;
};

/**
 * Check the password of an unmigrated identity against its legacy hash
 * and open a restricted email-remediation setup session. It never opens an
 * application session.
 *
 * Returns `null` for a migrated identity so the caller can continue through
 * Better Auth.
 */
export async function loginLegacyIdentity(
	db: Db,
	cookies: CookieAdapter,
	input: LegacyLoginInput,
): Promise<{ remediation: true } | null> {
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
		return null;
	}

	if (
		!user?.active ||
		user.lifecycleState !== "normal" ||
		!isValidHandle(input.handle) ||
		user.password === null ||
		!isPasswordHash(user.password)
	) {
		await verifyPassword(input.password, TIMING_DUMMY_HASH);
		throw new InvalidCredentialsError();
	}

	if (!(await verifyPassword(input.password, user.password))) {
		throw new InvalidCredentialsError();
	}

	const session = await createSetupSession(db, {
		userId: user.id,
		purpose: "email_remediation",
		ip: input.ip,
	});
	cookies.setSetupSession(session.sessionId, session.token);
	return { remediation: true };
}

/** Inputs to create the first instance user. */
export type CreateFirstUserInput = {
	handle: string;
	email: string;
	password: string;
	deliveryAvailable: boolean;
	getVerificationUrl: (token: string) => string;
	keyring: Keyring;
};

/**
 * Create the first instance user.
 *
 * The first user is always a full administrator. Creation is rejected once any
 * user exists, so the unauthenticated bootstrap endpoint can't be used to mint
 * further accounts. The web boundary signs the new identity in after commit.
 */
export async function createFirstUser(
	db: Db,
	input: CreateFirstUserInput,
): Promise<{ user: User; emailVerificationRequired: boolean }> {
	try {
		return await createFirstAdministrator(db, input);
	} catch (err) {
		if (err instanceof FirstAdministratorExistsError) {
			throw new FirstUserExistsError();
		}
		throw err;
	}
}

/**
 * Delete the restricted setup session named by its cookies, then clear them.
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

	cookies.clearSetup();
}
