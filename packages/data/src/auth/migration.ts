// The legacy identity audit and the eager Better Auth credential backfill.
//
// Framework-free: everything here takes a database handle and a logger. The
// `auth` subcommand in `apps/internal` owns process concerns — environment,
// report file, exit code — and nothing in this module knows they exist.
//
// The classification rules and their operational meaning are documented in
// `packages/data/README.md`.

import type { Logger } from "@virtool/logger";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/pg";
import { authAccounts } from "../db/schema/auth";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import {
	CREDENTIAL_PROVIDER_ID,
	credentialAccountId,
	syncCredentialPassword,
} from "./credential";
import { isValidEmail, normalizeEmail } from "./email";

/** The expected Better Auth schema is not present. */
export class AuthSchemaError extends AppError {}

/**
 * The report format version.
 *
 * Deployment automation reads these reports; a change to the shape of one is a
 * change to that contract and moves this number.
 */
export const IDENTITY_REPORT_VERSION = 1;

/** How many users one batch reads and reconciles. */
const DEFAULT_BATCH_SIZE = 500;

/**
 * A bcrypt hash as the `users.password` bytes decode.
 *
 * Anything else is not something Better Auth's password verifier can use, so a
 * user carrying it cannot be migrated even when their identity is complete.
 */
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * What the audit decides about one legacy user.
 *
 * Mutually exclusive, and evaluated in the order the checks are written in
 * {@link classifyIdentity}: the state of the Better Auth rows first, then the
 * identity, then the credential bytes.
 */
export type IdentityClassification =
	| "migrated"
	| "stale"
	| "conflict"
	| "blankEmail"
	| "invalidEmail"
	| "duplicateEmail"
	| "invalidPassword"
	| "eligible";

/**
 * Every classification, in report order.
 *
 * The report's `counts` keys follow this array, so two runs over the same data
 * serialize identically.
 */
export const IDENTITY_CLASSIFICATIONS: readonly IdentityClassification[] = [
	"eligible",
	"migrated",
	"stale",
	"conflict",
	"blankEmail",
	"invalidEmail",
	"duplicateEmail",
	"invalidPassword",
];

/**
 * The classifications an operator must act on before the population is
 * migrated. They make a run exit non-zero.
 */
const ACTIONABLE: readonly IdentityClassification[] = [
	"conflict",
	"invalidPassword",
];

/**
 * The classifications that leave a user unable to authenticate through Better
 * Auth, and so are reported row by row.
 */
const REPORTED: readonly IdentityClassification[] = [
	"conflict",
	"blankEmail",
	"invalidEmail",
	"duplicateEmail",
	"invalidPassword",
];

/** A count split by whether the users it covers are active. */
export type ActivitySplit = {
	active: number;
	deactivated: number;
};

/** One user the report names, with the reason it names them. */
export type IdentityReportRow = {
	userId: number;
	handle: string;
	active: boolean;
	classification: IdentityClassification;
	/**
	 * The normalized address, present only for a duplicate.
	 *
	 * A collision cannot be resolved without seeing the value that collides. No
	 * other row carries one: a blank address says nothing, and a malformed one
	 * is unvalidated text that only widens what the report spreads.
	 */
	normalizedEmail?: string;
};

/** A set of users whose email addresses normalize to the same value. */
export type DuplicateEmailGroup = {
	normalizedEmail: string;
	userIds: number[];
};

/** What one run did to the `auth_accounts` table. */
export type CredentialCounts = {
	planned: number;
	inserted: number;
	alreadyPresent: number;
	updated: number;
	conflicting: number;
	skipped: number;
};

/** The result of an audit or an apply run. */
export type IdentityReport = {
	version: number;
	generatedAt: string;
	mode: IdentityMigrationMode;
	users: number;
	counts: Record<IdentityClassification, ActivitySplit>;
	rows: IdentityReportRow[];
	duplicateGroups: DuplicateEmailGroup[];
	credentials: CredentialCounts;
};

/** Whether a run may write. */
export type IdentityMigrationMode = "audit" | "apply";

/** Options for {@link runIdentityMigration}. */
export type IdentityMigrationOptions = {
	mode: IdentityMigrationMode;
	batchSize?: number;
};

/** One legacy user, as the audit reads it. */
type UserRecord = {
	id: number;
	handle: string;
	active: boolean;
	email: string;
	password: Buffer;
	authMigratedAt: Date | null;
};

/** One Better Auth credential account, as the audit reads it. */
type CredentialRecord = {
	accountId: string;
	userId: number;
	password: string | null;
};

/** Report whether the bytes in `users.password` decode to a bcrypt hash. */
export function isBcryptHash(password: Buffer): boolean {
	return BCRYPT_PATTERN.test(password.toString("utf8"));
}

/**
 * Decide what one user is.
 *
 * Pure, so the rules can be exercised without a database. `duplicateEmails`
 * holds every normalized address that more than one user carries.
 */
export function classifyIdentity(
	user: UserRecord,
	credentials: readonly CredentialRecord[],
	duplicateEmails: ReadonlySet<string>,
): IdentityClassification {
	if (credentials.length > 0) {
		const [credential] = credentials;

		if (
			credentials.length > 1 ||
			credential === undefined ||
			credential.userId !== user.id ||
			credential.accountId !== credentialAccountId(user.id) ||
			credential.password === null
		) {
			return "conflict";
		}

		// A credential the migration did not write. Both rows are written in one
		// transaction, so a credential without the state that accompanies it came
		// from somewhere this contract does not describe.
		if (user.authMigratedAt === null) {
			return "conflict";
		}

		return credential.password === user.password.toString("utf8")
			? "migrated"
			: "stale";
	}

	if (user.authMigratedAt !== null) {
		return "conflict";
	}

	const normalized = normalizeEmail(user.email);

	if (normalized === "") {
		return "blankEmail";
	}

	if (!isValidEmail(user.email)) {
		return "invalidEmail";
	}

	if (duplicateEmails.has(normalized)) {
		return "duplicateEmail";
	}

	// Checked last so it means what it says: this user would migrate but for the
	// bytes in their password column.
	if (!isBcryptHash(user.password)) {
		return "invalidPassword";
	}

	return "eligible";
}

/**
 * Fail unless the database carries the schema this migration needs.
 *
 * `auth_accounts` arrives with the Better Auth foundation and
 * `users.auth_migrated_at` with this migration. Running against a database
 * missing either would report every user as unmigrated and then fail on the
 * first write, so it is refused up front.
 */
export async function checkAuthSchema(db: Db): Promise<void> {
	const [row] = await db.execute<{ tables: number; columns: number }>(sql`
		select
			(
				select count(*)::int from information_schema.tables
				where table_schema = 'public' and table_name = 'auth_accounts'
			) as tables,
			(
				select count(*)::int from information_schema.columns
				where table_schema = 'public'
					and table_name = 'users'
					and column_name = 'auth_migrated_at'
			) as columns
	`);

	if (row?.tables !== 1) {
		throw new AuthSchemaError(
			"missing table auth_accounts; apply pending migrations first",
		);
	}

	if (row?.columns !== 1) {
		throw new AuthSchemaError(
			"missing column users.auth_migrated_at; apply pending migrations first",
		);
	}
}

/**
 * Find every normalized address that more than one user holds.
 *
 * Its own pass over the table, because a collision is a property of the whole
 * population and a batch cannot see it. Only the normalized values that repeat
 * are kept, so the memory this holds is bounded by the collisions rather than
 * by the user count.
 */
async function findDuplicateEmails(
	db: Db,
	batchSize: number,
): Promise<Map<string, number[]>> {
	const seen = new Map<string, number[]>();

	for await (const batch of scanUsers(db, batchSize)) {
		for (const user of batch) {
			if (!isValidEmail(user.email)) {
				continue;
			}

			const normalized = normalizeEmail(user.email);
			const ids = seen.get(normalized);

			if (ids === undefined) {
				seen.set(normalized, [user.id]);
			} else {
				ids.push(user.id);
			}
		}
	}

	for (const [normalized, ids] of seen) {
		if (ids.length < 2) {
			seen.delete(normalized);
		}
	}

	return seen;
}

/**
 * Read the user table in id order, one batch at a time.
 *
 * Keyset rather than offset: a run is restartable and rows change under it, and
 * an offset would skip or repeat users when they do.
 */
async function* scanUsers(
	db: Db,
	batchSize: number,
): AsyncGenerator<UserRecord[]> {
	let cursor = 0;

	while (true) {
		const batch = await db
			.select({
				id: users.id,
				handle: users.handle,
				active: users.active,
				email: users.email,
				password: users.password,
				authMigratedAt: users.authMigratedAt,
			})
			.from(users)
			.where(gt(users.id, cursor))
			.orderBy(asc(users.id))
			.limit(batchSize);

		if (batch.length === 0) {
			return;
		}

		yield batch;

		const last = batch.at(-1);

		if (last === undefined) {
			return;
		}

		cursor = last.id;
	}
}

/** Read the credential accounts held by a batch of users. */
async function readCredentials(
	db: Db,
	userIds: number[],
): Promise<Map<number, CredentialRecord[]>> {
	const rows = await db
		.select({
			accountId: authAccounts.accountId,
			userId: authAccounts.userId,
			password: authAccounts.password,
		})
		.from(authAccounts)
		.where(
			and(
				inArray(authAccounts.userId, userIds),
				eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
			),
		);

	const byUser = new Map<number, CredentialRecord[]>();

	for (const row of rows) {
		const existing = byUser.get(row.userId);

		if (existing === undefined) {
			byUser.set(row.userId, [row]);
		} else {
			existing.push(row);
		}
	}

	return byUser;
}

/** A credential account row already exists and does not match the contract. */
class CredentialConflictError extends AppError {}

/**
 * Reconcile one eligible user.
 *
 * The user row and its credential account commit together: a user must never
 * be left carrying migration state with no credential to show for it, or a
 * credential with an un-normalized address.
 *
 * The `users` update is guarded on the password bytes the audit read and on
 * `auth_migrated_at` still being null. Nothing held a lock between the read and
 * this write, so a password change or a competing run can have landed in
 * between; the guard makes the loser of that race write nothing rather than
 * copy a hash that is no longer current. Under concurrency the second
 * transaction blocks on the row until the first commits, then re-evaluates the
 * guard and skips, so one credential account is created and not two.
 */
async function reconcileEligible(
	db: Db,
	user: UserRecord,
): Promise<"inserted" | "skipped"> {
	return db.transaction(async (tx) => {
		const updated = await tx
			.update(users)
			.set({
				email: normalizeEmail(user.email),
				username: user.handle.toLowerCase(),
				displayUsername: user.handle,
				authMigratedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(users.id, user.id),
					eq(users.password, user.password),
					isNull(users.authMigratedAt),
				),
			)
			.returning({ id: users.id });

		if (updated.length === 0) {
			return "skipped";
		}

		const now = new Date();

		const inserted = await tx
			.insert(authAccounts)
			.values({
				accountId: credentialAccountId(user.id),
				providerId: CREDENTIAL_PROVIDER_ID,
				userId: user.id,
				// Verbatim. The hash is already what Better Auth's configured verifier
				// expects, and rehashing it would need the password, which nobody has.
				password: user.password.toString("utf8"),
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing({
				target: [authAccounts.providerId, authAccounts.accountId],
			})
			.returning({ id: authAccounts.id });

		if (inserted.length === 0) {
			// The `(provider_id, account_id)` pair is taken by a row that is not this
			// user's — a credential pointing at a different user. Roll the whole
			// reconciliation back and let the operator look at it.
			throw new CredentialConflictError(
				`credential account ${credentialAccountId(user.id)} is held by another row`,
			);
		}

		return "inserted";
	});
}

/**
 * Copy the current `users.password` onto an existing credential account.
 *
 * The value is re-read inside the transaction and the row is locked, so a
 * password written between the audit and this write is the one that is copied
 * rather than the one that was overtaken.
 */
async function reconcileStale(
	db: Db,
	user: UserRecord,
): Promise<"updated" | "skipped"> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ password: users.password })
			.from(users)
			.where(eq(users.id, user.id))
			.for("update")
			.limit(1);

		if (current === undefined) {
			return "skipped";
		}

		if (!isBcryptHash(current.password)) {
			return "skipped";
		}

		await syncCredentialPassword(tx, user.id, current.password);

		return "updated";
	});
}

function emptySplit(): Record<IdentityClassification, ActivitySplit> {
	return Object.fromEntries(
		IDENTITY_CLASSIFICATIONS.map((classification) => [
			classification,
			{ active: 0, deactivated: 0 },
		]),
	) as Record<IdentityClassification, ActivitySplit>;
}

/**
 * Classify every legacy user, and in `apply` mode migrate the eligible ones.
 *
 * Audit is read-only. Apply performs the same classification and then writes,
 * so what it reports is what it saw before it acted; a fresh audit afterwards
 * is what confirms the result.
 *
 * The work is batched and each user commits on their own, so a run that dies
 * partway leaves committed users migrated and the rest untouched, and rerunning
 * resumes. A rerun over a correctly migrated user writes nothing.
 */
export async function runIdentityMigration(
	db: Db,
	logger: Logger,
	{ mode, batchSize = DEFAULT_BATCH_SIZE }: IdentityMigrationOptions,
): Promise<IdentityReport> {
	await checkAuthSchema(db);

	const duplicates = await findDuplicateEmails(db, batchSize);
	const duplicateEmails = new Set(duplicates.keys());

	const counts = emptySplit();
	const rows: IdentityReportRow[] = [];
	const credentials: CredentialCounts = {
		planned: 0,
		inserted: 0,
		alreadyPresent: 0,
		updated: 0,
		conflicting: 0,
		skipped: 0,
	};

	let scanned = 0;

	for await (const batch of scanUsers(db, batchSize)) {
		const byUser = await readCredentials(
			db,
			batch.map((user) => user.id),
		);

		for (const user of batch) {
			scanned += 1;

			const classification = classifyIdentity(
				user,
				byUser.get(user.id) ?? [],
				duplicateEmails,
			);

			const split = counts[classification];
			if (user.active) {
				split.active += 1;
			} else {
				split.deactivated += 1;
			}

			if (REPORTED.includes(classification)) {
				rows.push({
					userId: user.id,
					handle: user.handle,
					active: user.active,
					classification,
					...(classification === "duplicateEmail"
						? { normalizedEmail: normalizeEmail(user.email) }
						: {}),
				});
			}

			if (classification === "eligible") {
				credentials.planned += 1;
			}

			if (classification === "migrated") {
				credentials.alreadyPresent += 1;
			}

			if (classification === "conflict") {
				credentials.conflicting += 1;
			}

			if (mode === "audit") {
				continue;
			}

			try {
				if (classification === "eligible") {
					const outcome = await reconcileEligible(db, user);
					credentials[outcome === "inserted" ? "inserted" : "skipped"] += 1;
				}

				if (classification === "stale") {
					const outcome = await reconcileStale(db, user);
					credentials[outcome === "updated" ? "updated" : "skipped"] += 1;
				}
			} catch (err) {
				if (!(err instanceof CredentialConflictError)) {
					throw err;
				}

				credentials.conflicting += 1;
				rows.push({
					userId: user.id,
					handle: user.handle,
					active: user.active,
					classification: "conflict",
				});
			}
		}

		logger.info({ scanned }, "scanned legacy identities");
	}

	rows.sort((a, b) => a.userId - b.userId);

	const report: IdentityReport = {
		version: IDENTITY_REPORT_VERSION,
		generatedAt: new Date().toISOString(),
		mode,
		users: scanned,
		counts,
		rows,
		duplicateGroups: [...duplicates.entries()]
			.map(([normalizedEmail, userIds]) => ({
				normalizedEmail,
				userIds: [...userIds].sort((a, b) => a - b),
			}))
			.sort((a, b) => a.normalizedEmail.localeCompare(b.normalizedEmail)),
		credentials,
	};

	logger.info(
		{ mode, users: scanned, counts, credentials },
		"classified legacy identities",
	);

	return report;
}

/**
 * Report whether a run found something an operator has to resolve.
 *
 * An incomplete user is not one of them: they are the population the bounded
 * remediation window exists for, and a run that reports them has succeeded.
 */
export function hasActionableFindings(report: IdentityReport): boolean {
	// A conflict raised while applying — a credential account already held by
	// another row — never passes through a classification count.
	if (report.credentials.conflicting > 0) {
		return true;
	}

	return ACTIONABLE.some(
		(classification) =>
			report.counts[classification].active +
				report.counts[classification].deactivated >
			0,
	);
}
