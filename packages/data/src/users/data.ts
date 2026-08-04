import {
	type AdministratorRoleName,
	emptyPermissions,
	PERMISSION_NAMES,
	type Permissions,
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

/** A minimal group reference attached to a user, matching the legacy wire shape. */
export type UserGroupReference = {
	id: number;
	legacy_id: string | null;
	name: string;
};

/** A Virtool user as returned to the administration views. */
export type User = {
	id: number;
	handle: string;
	administrator_role: AdministratorRoleName | null;
	active: boolean;
	force_reset: boolean;
	groups: UserGroupReference[];
	last_password_change: string;
	permissions: Permissions;
	primary_group: UserGroupReference | null;
};

/** A signed-in user's client-side preferences. */
export type AccountSettings = {
	quick_analyze_workflow: "nuvs" | "pathoscope";
	show_ids: boolean;
	show_versions: boolean;
	skip_quick_analyze_dialog: boolean;
};

/**
 * The signed-in user's own view of themselves.
 *
 * A `User` plus the two fields only the account holder may read: their email
 * and their client settings.
 */
export type Account = User & {
	email: string;
	settings: AccountSettings;
};

/** A user reduced to what a selector or filter needs to show. */
export type UserOption = {
	id: number;
	handle: string;
};

/** A page of user search results. */
export type UserSearchResults = {
	items: User[];
	foundCount: number;
	totalCount: number;
	page: number;
	pageCount: number;
	perPage: number;
};

/** Filters accepted when searching users. */
export type FindUsersFilters = {
	term?: string;
	page?: number;
	perPage?: number;
	administrator?: boolean;
	active?: boolean;
};

/** Values accepted when creating a user. */
export type CreateUserValues = {
	handle: string;
	password: string;
	forceReset: boolean;
	administratorRole?: AdministratorRoleName | null;
};

/** Partial values accepted when updating a user. */
export type UserUpdateValues = {
	active?: boolean;
	force_reset?: boolean;
	handle?: string;
	password?: string;
	groups?: number[];
	primary_group?: number | null;
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

// Mirrors virtool/users/settings.py DEFAULT_USER_SETTINGS. The Python service
// owns this default for accounts it creates; we keep parity for accounts we
// create from this side.
const DEFAULT_USER_SETTINGS = {
	skip_quick_analyze_dialog: true,
	show_ids: true,
	show_versions: true,
	quick_analyze_workflow: "pathoscope",
};

// Mirrors AVAILABLE_ROLES in virtool/administrators/api.py: every member of the
// AdministratorRole enum, with its capitalized name and docstring description.
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
		id: "spaces",
		name: "Spaces",
		description: "Manage users in any space. Delete any space.",
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
			"Provides ability to:\n    - Create new spaces even if the `Free Spaces` setting is not enabled.\n    - Manage HMMs and common references.\n    - View all running jobs.\n    - Cancel any job.",
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
		legacy_id: membership.legacyId,
		name: membership.name,
	}));
	const primary = memberships.find((membership) => membership.primary);

	return {
		id: row.id,
		handle: row.handle,
		administrator_role: row.administratorRole,
		active: row.active,
		force_reset: row.forceReset,
		groups,
		last_password_change: row.lastPasswordChange.toISOString(),
		permissions: mergePermissions(
			memberships.map((membership) => membership.permissions),
		),
		primary_group: primary
			? { id: primary.id, legacy_id: primary.legacyId, name: primary.name }
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

/** List every active user, for populating selectors and filters. */
export async function listUsers(db: Db): Promise<UserOption[]> {
	return db
		.select({ id: usersTable.id, handle: usersTable.handle })
		.from(usersTable)
		.where(eq(usersTable.active, true))
		.orderBy(asc(sql`lower(${usersTable.handle})`));
}

export async function findUsers(
	db: Db,
	filters: FindUsersFilters,
): Promise<UserSearchResults> {
	const {
		term = "",
		page = 1,
		perPage = 25,
		administrator,
		active = true,
	} = filters;

	const conditions = [eq(usersTable.active, active)];
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
		settings: row.settings as AccountSettings,
	};
}

/**
 * Set the signed-in user's email address.
 *
 * An empty string clears it, which is what Python's `check_email` allows and
 * what a user who wants no address on file submits.
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
 * Mirrors `AccountData.update` in `virtool/account/data.py`: the change clears
 * `force_reset`, revokes every session the user has, and mints a replacement so
 * the browser that submitted the form is not signed out by its own request. The
 * replacement never remembers — Python passes `remember=False` here too, so a
 * password change downgrades a 30-day session to the 60-minute one.
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

	if (!(await verifyPassword(oldPassword, existing.password))) {
		throw new InvalidPasswordError();
	}

	// Hashing is CPU-bound and slow by design, so it happens before the
	// transaction opens rather than holding one idle for the duration.
	const hashed = await hashPassword(password);

	// One unit: a failure partway through must not leave the password changed
	// with no session to show for it. The order keeps Python's — update the user,
	// revoke the old sessions, then create the replacement, which has to come
	// last or the revocation would take it with the rest.
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
					eq(usersTable.password, existing.password),
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
					settings: DEFAULT_USER_SETTINGS,
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
		.select({ id: usersTable.id })
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!existing) {
		throw new UserNotFoundError();
	}

	// Changing credentials or activation revokes every existing session for the
	// user, in the same transaction as the change that triggered it, so there is
	// no window where the old password still authenticates.
	const patch: Partial<typeof usersTable.$inferInsert> = {};
	if (values.active !== undefined) {
		patch.active = values.active;
	}
	if (values.force_reset !== undefined) {
		patch.forceReset = values.force_reset;
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
		values.force_reset !== undefined ||
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
			// without also sending primary_group doesn't silently clear it.
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

		if (values.primary_group === null) {
			await tx
				.update(userGroupsTable)
				.set({ primary: false })
				.where(eq(userGroupsTable.userId, userId));
		} else if (values.primary_group !== undefined) {
			const promoted = await tx
				.update(userGroupsTable)
				.set({ primary: true })
				.where(
					and(
						eq(userGroupsTable.userId, userId),
						eq(userGroupsTable.groupId, values.primary_group),
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
						ne(userGroupsTable.groupId, values.primary_group),
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
