import { timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import {
	consumeResetSession,
	createAuthenticatedSession,
	createResetSession,
	invalidateSession,
	invalidateUserSessions,
} from "@virtool/data/auth/session";
import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createUser,
	getUserCount,
	type User,
	UserConflictError,
} from "@virtool/data/users/data";
import { and, eq, sql } from "drizzle-orm";
import type { CookieAdapter } from "./cookies";

// A real bcrypt hash used to equalize timing when no user is found. Keeps the
// missing-handle and wrong-password code paths indistinguishable to a timing
// observer.
const TIMING_DUMMY_HASH = Buffer.from(
	"$2b$12$0000000000000000000000000000000000000000000000000000O",
	"utf8",
);

/** Plaintext credentials submitted by a login attempt. */
export type LoginInput = {
	handle: string;
	password: string;
	remember: boolean;
	ip: string;
};

/** Outcome of a successful credential check; reset_required defers to /reset. */
export type LoginResult =
	| { status: "authenticated" }
	| { status: "reset_required"; resetCode: string };

export class InvalidCredentialsError extends Error {
	constructor() {
		super("Invalid credentials");
		this.name = "InvalidCredentialsError";
	}
}

/** Reset session is missing, expired, or the supplied reset_code does not match. */
export class InvalidResetSessionError extends Error {
	constructor() {
		super("Invalid session");
		this.name = "InvalidResetSessionError";
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

/** Inputs to create and authenticate the first instance user. */
export type CreateFirstUserInput = {
	handle: string;
	password: string;
	ip: string;
};

/**
 * Create the first instance user and log them in.
 *
 * The first user is always a full administrator. Creation is rejected once any
 * user exists, so the unauthenticated bootstrap endpoint can't be used to mint
 * further accounts. On success an authenticated session is written and the
 * session cookies are set, so the caller lands in the app without a separate
 * login step.
 *
 * The count check and insert are not a single atomic statement — Python owns
 * the schema, so we can't add a DB-level "single user" constraint here. A
 * concurrent bootstrap that wins the insert instead trips the existing unique
 * handle index; that `UserConflictError` is surfaced as the same
 * already-set-up outcome as the count guard.
 */
export async function createFirstUser(
	db: Db,
	cookies: CookieAdapter,
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

	const { sessionId, token } = await createAuthenticatedSession(db, {
		userId: user.id,
		ip: input.ip,
		remember: false,
	});
	cookies.setSessionId(sessionId);
	cookies.setSessionToken(token);

	return user;
}

export async function login(
	db: Db,
	cookies: CookieAdapter,
	input: LoginInput,
): Promise<LoginResult> {
	const handle = input.handle.toLowerCase();

	const [user] = await db
		.select()
		.from(users)
		.where(sql`lower(${users.handle}) = ${handle}`)
		.limit(1);

	if (!user?.active) {
		await verifyPassword(input.password, TIMING_DUMMY_HASH);
		throw new InvalidCredentialsError();
	}

	const ok = await verifyPassword(input.password, user.password);
	if (!ok) {
		throw new InvalidCredentialsError();
	}

	if (user.forceReset) {
		const { sessionId, resetCode } = await createResetSession(db, {
			userId: user.id,
			ip: input.ip,
			remember: input.remember,
		});
		cookies.setSessionId(sessionId);
		return { status: "reset_required", resetCode };
	}

	const { sessionId, token } = await createAuthenticatedSession(db, {
		userId: user.id,
		ip: input.ip,
		remember: input.remember,
	});
	cookies.setSessionId(sessionId);
	cookies.setSessionToken(token);
	return { status: "authenticated" };
}

export async function logout(db: Db, cookies: CookieAdapter): Promise<void> {
	const sessionId = cookies.getSessionId();
	if (sessionId) {
		await invalidateSession(db, sessionId);
	}
	cookies.clear();
}

/** Inputs to complete a forced-reset password change. */
export type ResetPasswordInput = {
	password: string;
	resetCode: string;
	ip: string;
};

// Constant-time string compare. Equal-length buffers required; mismatched
// lengths short-circuit to false without leaking timing on the contents.
function constantTimeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export async function resetPassword(
	db: Db,
	cookies: CookieAdapter,
	input: ResetPasswordInput,
): Promise<void> {
	const sessionId = cookies.getSessionId();
	if (!sessionId) {
		throw new InvalidResetSessionError();
	}

	const [row] = await db
		.select()
		.from(sessions)
		.where(
			and(eq(sessions.sessionId, sessionId), eq(sessions.sessionType, "reset")),
		)
		.limit(1);

	if (!row?.resetCode || row.userId === null) {
		throw new InvalidResetSessionError();
	}

	// Bound here rather than read off `row` below: the narrowing above does not
	// survive into the transaction callback.
	const userId = row.userId;

	if (!constantTimeEqualHex(row.resetCode, input.resetCode)) {
		await invalidateSession(db, sessionId);
		throw new InvalidResetSessionError();
	}

	if (row.expiresAt.getTime() <= Date.now()) {
		await invalidateSession(db, sessionId);
		throw new InvalidResetSessionError();
	}

	const [user] = await db
		.select({ password: users.password })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw new InvalidResetSessionError();
	}

	const sameAsCurrent = await verifyPassword(input.password, user.password);
	if (sameAsCurrent) {
		throw new PasswordReuseError();
	}

	// Hashing is CPU-bound and slow by design, so it happens before the
	// transaction opens rather than holding one idle for the duration.
	const newHash = await hashPassword(input.password);

	const remember = row.resetRemember ?? false;

	// The writes are one unit: a failure partway through must not leave the
	// password changed with no session to show for it.
	//
	// Consuming the reset session first makes the code single-use under
	// concurrency. Everything above — validation, the reuse check, the hash —
	// takes no lock, so two submissions of the same code can both reach this
	// point; only the one that deletes the row proceeds. Without it the loser
	// would go on to invalidate the sessions of the winner, handing the browser
	// cookies for a session that no longer exists.
	//
	// The remaining writes keep Python's order in
	// `virtool.account.data.AccountData.reset`:
	//   delete_by_user → users.update → sessions.create_authenticated.
	// Sequencing matters so a user mid-reset sees the same behaviour regardless
	// of which backend serves them during the transition. `delete_by_user` would
	// have removed the reset session anyway, so consuming it above leaves the
	// committed state identical.
	const { sessionId: newSessionId, token } = await db.transaction(
		async (tx) => {
			if (!(await consumeResetSession(tx, sessionId))) {
				throw new InvalidResetSessionError();
			}

			await invalidateUserSessions(tx, userId);

			await tx
				.update(users)
				.set({
					password: newHash,
					forceReset: false,
					lastPasswordChange: new Date(),
				})
				.where(eq(users.id, userId));

			return createAuthenticatedSession(tx, {
				userId,
				ip: input.ip,
				remember,
			});
		},
	);

	// Only after the commit. A rolled-back reset must leave the browser holding
	// no new session.
	cookies.setSessionId(newSessionId);
	cookies.setSessionToken(token);
}
