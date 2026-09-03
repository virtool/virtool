import {
	type Account,
	type AccountLifecycleState,
	type AccountSettings,
	type AdministratorRoleName,
	emptyPermissions,
	PERMISSION_NAMES,
	type Permissions,
	type User,
	type UserNested,
	type UserSearchResult,
} from "@virtool/contracts";
import {
	and,
	asc,
	count,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	ne,
	sql,
} from "drizzle-orm";
import type { PostgresError } from "postgres";
import { hashPassword, verifyPassword } from "../auth/password";
import {
	createAuthenticatedSession,
	invalidateUserSessions,
} from "../auth/session";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	groups as groupsTable,
	userGroups as userGroupsTable,
} from "../db/schema/groups";
import { type UserRow, users as usersTable } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/**
 * {@link AccountSettings} as it is stored in the `users.settings` JSONB column.
 *
 * snake_case, and byte-compatible with the blobs already stored against every
 * account that exists today. **Never returned from a read, and never written
 * from a model value**: map with {@link fromStoredAccountSettings} and
 * {@link toStoredAccountSettings} instead.
 *
 * The column is typed `Record<string, unknown>` and was previously read with a
 * blind cast, so nothing but this mapper stands between a rename on this side
 * and every existing user's preferences silently reading `undefined`.
 */
type StoredAccountSettings = {
	quick_analyze_workflow: "nuvs" | "pathoscope";
	show_ids: boolean;
	show_versions: boolean;
	skip_quick_analyze_dialog: boolean;
};

/**
 * Map the stored blob to the camelCase model.
 *
 * Every field falls back to its default rather than trusting the column: the
 * blob is untyped `jsonb`, and a row written by an older release may be missing
 * a key this side now expects.
 */
function fromStoredAccountSettings(stored: unknown): AccountSettings {
	const blob = (stored ?? {}) as Partial<StoredAccountSettings>;

	return {
		quickAnalyzeWorkflow:
			blob.quick_analyze_workflow ?? DEFAULT_USER_SETTINGS.quickAnalyzeWorkflow,
		showIds: blob.show_ids ?? DEFAULT_USER_SETTINGS.showIds,
		showVersions: blob.show_versions ?? DEFAULT_USER_SETTINGS.showVersions,
		skipQuickAnalyzeDialog:
			blob.skip_quick_analyze_dialog ??
			DEFAULT_USER_SETTINGS.skipQuickAnalyzeDialog,
	};
}

/** Map the camelCase model to the shape written to the `settings` column. */
function toStoredAccountSettings(
	settings: AccountSettings,
): StoredAccountSettings {
	return {
		quick_analyze_workflow: settings.quickAnalyzeWorkflow,
		show_ids: settings.showIds,
		show_versions: settings.showVersions,
		skip_quick_analyze_dialog: settings.skipQuickAnalyzeDialog,
	};
}

/** Filters accepted when searching users. */
export type FindUsersFilters = {
	term?: string;
	page?: number;
	perPage?: number;
	administrator?: boolean;
	active?: boolean;
	/**
	 * Which lifecycle states to return. Defaults to `"normal"`, so a caller
	 * that has not thought about pending accounts does not publish them.
	 *
	 * `"any"` is for the user administration views, which are the one place a
	 * pending account has to be visible — an administrator needs to see the
	 * invitation they issued and to be able to re-issue it.
	 */
	lifecycleState?: AccountLifecycleState | "any";
};

/** Values accepted when creating a user. */
export type CreateUserValues = {
	handle: string;
	password: string;
	forceReset: boolean;
	administratorRole?: AdministratorRoleName | null;
};

/** Values accepted when creating a pending user. */
export type CreatePendingUserValues = {
	handle: string;
	administratorRole?: AdministratorRoleName | null;
	groups?: number[];
};

/** Partial values accepted when updating a user. */
export type UserUpdateValues = {
	active?: boolean;
	forceReset?: boolean;
	handle?: string;
	password?: string;
	groups?: number[];
	primaryGroup?: number | null;
};

/** Inputs to change the signed-in user's own password. */
export type ChangePasswordValues = {
	userId: number;
	oldPassword: string;
	password: string;
	ip: string;
};

/**
 * A completed password change, with the session credentials that replace the
 * ones the change revoked.
 */
export type ChangePasswordResult = {
	account: Account;
	sessionId: string;
	token: string;
};

/** A selectable administrator role with its human-readable name and description. */
export type AdministratorRole = {
	id: AdministratorRoleName;
	name: string;
	description: string;
};

/** Thrown when a requested user does not exist. */
export class UserNotFoundError extends AppError {}

/** Thrown when a supplied password does not match the user's stored one. */
export class InvalidPasswordError extends AppError {}

/** Thrown when a user handle conflicts with an existing user. */
export class UserConflictError extends AppError {}

/** Thrown when a primary group is set to a group the user does not belong to. */
export class GroupMembershipError extends AppError {}

/**
 * Thrown when an operation that assumes a usable account is aimed at one that
 * has not completed setup.
 */
export class PendingAccountError extends AppError {}

// The settings every newly created account starts with, and the fallback for
// any key a stored blob is missing.
const DEFAULT_USER_SETTINGS: AccountSettings = {
	skipQuickAnalyzeDialog: true,
	showIds: true,
	showVersions: true,
	quickAnalyzeWorkflow: "pathoscope",
};

// Every member of the administrator-role enum, with its capitalized name and
// description.
const ADMINISTRATOR_ROLES: AdministratorRole[] = [
	{
		id: "full",
		name: "Full",
		description: "Manage who is an administrator and what they can do.",
	},
	{
		id: "settings",
		name: "Settings",
		description: "Manage instance settings.",
	},
	{
		id: "users",
		name: "Users",
		description: "Create user accounts. Control activation of user accounts.",
	},
	{
		id: "base",
		name: "Base",
		description:
			"Provides ability to:\n    - Manage HMMs and common references.\n    - View all running jobs.\n    - Cancel any job.",
	},
];

/** Merge the permissions granted by membership in a list of groups. */
function mergePermissions(memberships: Permissions[]): Permissions {
	const merged = emptyPermissions();
	for (const key of PERMISSION_NAMES) {
		for (const permissions of memberships) {
			if (permissions[key]) {
				merged[key] = true;
				break;
			}
		}
	}
	return merged;
}

function isUniqueViolation(error: unknown): boolean {
	if (error === null || typeof error !== "object") {
		return false;
	}
	const cause = (error as { cause?: unknown }).cause;
	return (
		(error as Partial<PostgresError>).code === "23505" ||
		(cause !== null &&
			typeof cause === "object" &&
			(cause as Partial<PostgresError>).code === "23505")
	);
}

type GroupMembershipRow = {
	userId: number;
	primary: boolean;
	id: number;
	legacyId: string | null;
	name: string;
	permissions: Permissions;
};

async function fetchGroupMemberships(
	db: Db,
	userIds: number[],
): Promise<GroupMembershipRow[]> {
	if (userIds.length === 0) {
		return [];
	}

	return db
		.select({
			userId: userGroupsTable.userId,
			primary: userGroupsTable.primary,
			id: groupsTable.id,
			legacyId: groupsTable.legacyId,
			name: groupsTable.name,
			permissions: groupsTable.permissions,
		})
		.from(userGroupsTable)
		.innerJoin(groupsTable, eq(groupsTable.id, userGroupsTable.groupId))
		.where(inArray(userGroupsTable.userId, userIds))
		.orderBy(asc(groupsTable.name));
}

function buildUser(row: UserRow, memberships: GroupMembershipRow[]): User {
	const groups = memberships.map((membership) => ({
		id: membership.id,
		legacyId: membership.legacyId,
		name: membership.name,
	}));
	const primary = memberships.find((membership) => membership.primary);

	return {
		id: row.id,
		handle: row.handle,
		administratorRole: row.administratorRole,
		active: row.active,
		forceReset: row.forceReset,
		groups,
		lastPasswordChange: row.lastPasswordChange,
		lifecycleState: row.lifecycleState,
		permissions: mergePermissions(
			memberships.map((membership) => membership.permissions),
		),
		primaryGroup: primary
			? { id: primary.id, legacyId: primary.legacyId, name: primary.name }
			: null,
	};
}

async function assembleUsers(db: Db, rows: UserRow[]): Promise<User[]> {
	const memberships = await fetchGroupMemberships(
		db,
		rows.map((row) => row.id),
	);

	const byUser = new Map<number, GroupMembershipRow[]>();
	for (const membership of memberships) {
		const list = byUser.get(membership.userId) ?? [];
		list.push(membership);
		byUser.set(membership.userId, list);
	}

	return rows.map((row) => buildUser(row, byUser.get(row.id) ?? []));
}

/** List the administrator roles a user may be assigned. */
export function listAdministratorRoles(): AdministratorRole[] {
	return ADMINISTRATOR_ROLES;
}

/** Count all user rows. Used to detect the first-user setup bootstrap. */
export async function getUserCount(db: Db): Promise<number> {
	const [row] = await db.select({ value: count() }).from(usersTable);
	return row?.value ?? 0;
}

/**
 * List every usable user, for populating selectors and filters.
 *
 * Pending accounts are left out. This answers "who can something be assigned
 * to", and an account that cannot sign in yet is not an answer to that.
 */
export async function listUsers(db: Db): Promise<UserNested[]> {
	return db
		.select({ id: usersTable.id, handle: usersTable.handle })
		.from(usersTable)
		.where(
			and(eq(usersTable.active, true), eq(usersTable.lifecycleState, "normal")),
		)
		.orderBy(asc(sql`lower(${usersTable.handle})`));
}

export async function findUsers(
	db: Db,
	filters: FindUsersFilters,
): Promise<UserSearchResult> {
	const {
		term = "",
		page = 1,
		perPage = 25,
		administrator,
		active = true,
		lifecycleState = "normal",
	} = filters;

	const conditions = [eq(usersTable.active, active)];
	if (lifecycleState !== "any") {
		conditions.push(eq(usersTable.lifecycleState, lifecycleState));
	}
	if (administrator === true) {
		conditions.push(isNotNull(usersTable.administratorRole));
	}
	if (administrator === false) {
		conditions.push(isNull(usersTable.administratorRole));
	}
	if (term) {
		conditions.push(ilike(usersTable.handle, `%${term}%`));
	}
	const filter = and(...conditions);
	const skip = page > 1 ? (page - 1) * perPage : 0;

	const [[totalRow], [foundRow], rows] = await Promise.all([
		db.select({ value: count() }).from(usersTable),
		db.select({ value: count() }).from(usersTable).where(filter),
		db
			.select()
			.from(usersTable)
			.where(filter)
			.orderBy(asc(sql`lower(${usersTable.handle})`))
			.limit(perPage)
			.offset(skip),
	]);

	const foundCount = foundRow?.value ?? 0;

	return {
		items: await assembleUsers(db, rows),
		foundCount,
		totalCount: totalRow?.value ?? 0,
		page,
		pageCount: perPage > 0 ? Math.ceil(foundCount / perPage) : 0,
		perPage,
	};
}

export async function getUser(db: Db, userId: number): Promise<User> {
	const [row] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!row) {
		throw new UserNotFoundError();
	}

	return takeFirstOrThrow(await assembleUsers(db, [row]));
}

/** Read the signed-in user's own account, including their email and settings. */
export async function getAccount(db: Db, userId: number): Promise<Account> {
	const [row] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!row) {
		throw new UserNotFoundError();
	}

	const user = takeFirstOrThrow(await assembleUsers(db, [row]));

	return {
		...user,
		email: row.email,
		settings: fromStoredAccountSettings(row.settings),
	};
}

/**
 * Set the signed-in user's email address.
 *
 * An empty string clears it, which is what a user who wants no address on file
 * submits and what the email check deliberately allows.
 */
export async function updateAccountEmail(
	db: Db,
	userId: number,
	email: string,
): Promise<Account> {
	const [row] = await db
		.update(usersTable)
		.set({ email })
		.where(eq(usersTable.id, userId))
		.returning({ id: usersTable.id });

	if (!row) {
		throw new UserNotFoundError();
	}

	return getAccount(db, userId);
}

/**
 * Change the signed-in user's own password, after verifying the one they
 * already hold.
 *
 * The change clears `force_reset`, revokes every session the user has, and
 * mints a replacement so the browser that submitted the form is not signed out
 * by its own request. The replacement never remembers — `remember` is false
 * here too — so a password change downgrades a 30-day session to the 60-minute
 * one.
 *
 * The caller writes the returned credentials to the response cookies. Unlike
 * login and reset, which set different cookies depending on how they resolve,
 * this has no branch to make, so the transport stays out of the data layer.
 */
export async function changePassword(
	db: Db,
	{ userId, oldPassword, password, ip }: ChangePasswordValues,
): Promise<ChangePasswordResult> {
	const [existing] = await db
		.select({ password: usersTable.password })
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!existing) {
		throw new UserNotFoundError();
	}

	// A pending account has no password to verify against and no session to
	// have reached this from. Reported as a bad credential rather than as a
	// lifecycle state, which is all the caller of a password form needs.
	if (existing.password === null) {
		throw new InvalidPasswordError();
	}

	const currentPassword = existing.password;

	if (!(await verifyPassword(oldPassword, currentPassword))) {
		throw new InvalidPasswordError();
	}

	// Hashing is CPU-bound and slow by design, so it happens before the
	// transaction opens rather than holding one idle for the duration.
	const hashed = await hashPassword(password);

	// One unit: a failure partway through must not leave the password changed
	// with no session to show for it. The order matters — update the user, revoke
	// the old sessions, then create the replacement, which has to come last or
	// the revocation would take it with the rest.
	//
	// The update matches on the hash we verified, not just the id. Nothing held a
	// lock across the read, the bcrypt verify, and the bcrypt hash above, and at
	// cost 12 that gap is hundreds of milliseconds — long enough for an
	// administrator responding to a compromise to reset this password or set
	// force_reset in between. Without the guard we would overwrite their newer
	// credential, clear the flag they just set, and hand the attacker a fresh
	// session. Matching on the old hash makes the loser of that race update
	// nothing, and an unchanged password is exactly the case the caller already
	// reports as bad credentials.
	const { sessionId, token } = await db.transaction(async (tx) => {
		const updated = await tx
			.update(usersTable)
			.set({
				password: hashed,
				forceReset: false,
				lastPasswordChange: new Date(),
			})
			.where(
				and(
					eq(usersTable.id, userId),
					eq(usersTable.password, currentPassword),
				),
			)
			.returning({ id: usersTable.id });

		if (updated.length === 0) {
			throw new InvalidPasswordError();
		}

		await invalidateUserSessions(tx, userId);

		return createAuthenticatedSession(tx, { userId, ip, remember: false });
	});

	// An administrator with this user's detail open sees last_password_change and
	// force_reset, both of which just moved, so the change is published the way
	// updateUser publishes its own.
	await emit("users", userId, "update");

	return { account: await getAccount(db, userId), sessionId, token };
}

/** Read a user's administrator role without assembling the full user. */
export async function getAdministratorRole(
	db: Db,
	userId: number,
): Promise<AdministratorRoleName | null> {
	const [row] = await db
		.select({ administratorRole: usersTable.administratorRole })
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	return row?.administratorRole ?? null;
}

/**
 * Create an account that exists but cannot yet be signed in as.
 *
 * The handle, the administrator role and the group memberships are all set
 * here, so an administrator states who the person is and what they may do at
 * the moment of invitation rather than after they accept. What is missing is
 * the credential: `password` stays null and `lifecycle_state` is `pending`,
 * which the `pending_has_no_password` constraint holds together.
 *
 * No password is generated and none is transmitted. Completing the account is
 * `completeAccountSetup`'s job, authorized by a setup token.
 *
 * `active` is left at its default of true. Activation is the administrator's
 * separate switch, and a pending account is already unusable — conflating the
 * two would make deactivating an invited user indistinguishable from never
 * having invited them.
 */
export async function createPendingUser(
	db: Db,
	values: CreatePendingUserValues,
): Promise<User> {
	const groupIds = Array.from(new Set(values.groups ?? []));

	try {
		const userId = await db.transaction(async (tx) => {
			const row = takeFirstOrThrow(
				await tx
					.insert(usersTable)
					.values({
						handle: values.handle,
						lifecycleState: "pending",
						administratorRole: values.administratorRole ?? null,
						lastPasswordChange: new Date(),
						legacyId: null,
						settings: toStoredAccountSettings(DEFAULT_USER_SETTINGS),
					})
					.returning({ id: usersTable.id }),
			);

			if (groupIds.length > 0) {
				await tx.insert(userGroupsTable).values(
					groupIds.map((groupId) => ({
						userId: row.id,
						groupId,
						primary: false,
					})),
				);
			}

			return row.id;
		});

		await emit("users", userId, "create");

		return getUser(db, userId);
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new UserConflictError();
		}
		throw error;
	}
}

export async function createUser(
	db: Db,
	values: CreateUserValues,
): Promise<User> {
	const password = await hashPassword(values.password);

	try {
		const row = takeFirstOrThrow(
			await db
				.insert(usersTable)
				.values({
					handle: values.handle,
					password,
					forceReset: values.forceReset,
					administratorRole: values.administratorRole ?? null,
					lastPasswordChange: new Date(),
					legacyId: null,
					settings: toStoredAccountSettings(DEFAULT_USER_SETTINGS),
				})
				.returning({ id: usersTable.id }),
		);

		await emit("users", row.id, "create");

		return getUser(db, row.id);
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new UserConflictError();
		}
		throw error;
	}
}

export async function updateUser(
	db: Db,
	userId: number,
	values: UserUpdateValues,
): Promise<User> {
	const [existing] = await db
		.select({
			id: usersTable.id,
			lifecycleState: usersTable.lifecycleState,
		})
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!existing) {
		throw new UserNotFoundError();
	}

	// Setting a password on a pending account would complete its setup without
	// the token that authorizes the transition, and leave a `pending` row
	// carrying a credential the `pending_has_no_password` constraint forbids.
	// Refused here so the caller gets a stated reason rather than a check
	// violation.
	if (values.password !== undefined && existing.lifecycleState === "pending") {
		throw new PendingAccountError();
	}

	// Changing credentials or activation revokes every existing session for the
	// user, in the same transaction as the change that triggered it, so there is
	// no window where the old password still authenticates.
	const patch: Partial<typeof usersTable.$inferInsert> = {};
	if (values.active !== undefined) {
		patch.active = values.active;
	}
	if (values.forceReset !== undefined) {
		patch.forceReset = values.forceReset;
	}
	if (values.handle !== undefined) {
		patch.handle = values.handle;
	}
	if (values.password !== undefined) {
		patch.password = await hashPassword(values.password);
		patch.lastPasswordChange = new Date();
	}

	const revokeSessions =
		values.active !== undefined ||
		values.forceReset !== undefined ||
		values.password !== undefined;

	await db.transaction(async (tx) => {
		if (Object.keys(patch).length > 0) {
			try {
				await tx.update(usersTable).set(patch).where(eq(usersTable.id, userId));
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new UserConflictError();
				}
				throw error;
			}
		}

		if (revokeSessions) {
			await invalidateUserSessions(tx, userId);
		}

		if (values.groups !== undefined) {
			// Re-applied to the new membership rows so toggling group membership
			// without also sending primaryGroup doesn't silently clear it.
			const currentPrimary = await tx
				.select({ groupId: userGroupsTable.groupId })
				.from(userGroupsTable)
				.where(
					and(
						eq(userGroupsTable.userId, userId),
						eq(userGroupsTable.primary, true),
					),
				)
				.limit(1)
				.then((rows) => rows[0]?.groupId);

			await tx
				.delete(userGroupsTable)
				.where(eq(userGroupsTable.userId, userId));

			const uniqueGroupIds = Array.from(new Set(values.groups));
			if (uniqueGroupIds.length > 0) {
				await tx.insert(userGroupsTable).values(
					uniqueGroupIds.map((groupId) => ({
						userId,
						groupId,
						primary: groupId === currentPrimary,
					})),
				);
			}
		}

		if (values.primaryGroup === null) {
			await tx
				.update(userGroupsTable)
				.set({ primary: false })
				.where(eq(userGroupsTable.userId, userId));
		} else if (values.primaryGroup !== undefined) {
			const promoted = await tx
				.update(userGroupsTable)
				.set({ primary: true })
				.where(
					and(
						eq(userGroupsTable.userId, userId),
						eq(userGroupsTable.groupId, values.primaryGroup),
					),
				)
				.returning({ groupId: userGroupsTable.groupId });

			if (promoted.length === 0) {
				throw new GroupMembershipError();
			}

			await tx
				.update(userGroupsTable)
				.set({ primary: false })
				.where(
					and(
						eq(userGroupsTable.userId, userId),
						ne(userGroupsTable.groupId, values.primaryGroup),
					),
				);
		}
	});

	await emit("users", userId, "update");

	return getUser(db, userId);
}

export async function setAdministratorRole(
	db: Db,
	userId: number,
	role: AdministratorRoleName | null,
): Promise<User> {
	const [row] = await db
		.update(usersTable)
		.set({ administratorRole: role })
		.where(eq(usersTable.id, userId))
		.returning({ id: usersTable.id });

	if (!row) {
		throw new UserNotFoundError();
	}

	await emit("users", userId, "update");

	return getUser(db, userId);
}
