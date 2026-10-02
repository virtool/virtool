import {
	type Account,
	type AccountLifecycleState,
	type AccountSecurity,
	type AccountSettings,
	ADMINISTRATOR_ROLES,
	type AdministeredUserDetail,
	type AdministeredUserSearchResult,
	type AdministratorRole,
	type AdministratorRoleName,
	AVATAR_SOURCES,
	type AvatarSource,
	emptyPermissions,
	PATHOSCOPE_COLUMNS,
	type PathoscopeColumn,
	PERMISSION_NAMES,
	type Permissions,
	type SortDirection,
	type User,
	type UserNested,
	type UserRoleFilter,
	type UserSearchResult,
	type UserSortField,
	type UserStatus,
} from "@virtool/contracts";
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { claimEmail, normalizeEmail } from "../auth/email";
import { queueEmailVerificationInTransaction } from "../auth/emailVerification";
import {
	CREDENTIAL_PROVIDER_ID,
	updateAuthPassword,
	updateAuthUsername,
} from "../auth/identity";
import { hashPassword, verifyPassword } from "../auth/password";
import { invalidateUserSessions } from "../auth/session";
import {
	invalidateUserSetupSessions,
	invalidateUserSetupTokens,
	lockUserSetupCredentials,
	supersedeSetupTokens,
} from "../auth/setup";
import { isForeignKeyViolation, isUniqueViolation } from "../db/errors";
import { getPageCount, getPageOffset } from "../db/pagination";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { authAccounts, authSessions } from "../db/schema/auth";
import {
	groups as groupsTable,
	userGroups as userGroupsTable,
} from "../db/schema/groups";
import { settings as settingsTable } from "../db/schema/settings";
import { setupTokens } from "../db/schema/setup";
import { type UserRow, users as usersTable } from "../db/schema/users";
import { toSearchPattern } from "../db/search";
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
function isPathoscopeColumns(value: unknown): value is PathoscopeColumn[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		new Set(value).size === value.length &&
		value.every((column) => PATHOSCOPE_COLUMNS.includes(column))
	);
}

type StoredAccountSettings = {
	pathoscope_columns: PathoscopeColumn[];
	/** Stored under its older name; the model calls it `preferAcronym`. */
	prefer_abbreviation: boolean;
	quick_analyze_workflow: "nuvs" | "pathoscope";
	show_ids: boolean;
	show_versions: boolean;
	skip_quick_analyze_dialog: boolean;
	avatar_source: AvatarSource;
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
		pathoscopeColumns: isPathoscopeColumns(blob.pathoscope_columns)
			? blob.pathoscope_columns
			: DEFAULT_USER_SETTINGS.pathoscopeColumns,
		preferAcronym:
			blob.prefer_abbreviation ?? DEFAULT_USER_SETTINGS.preferAcronym,
		quickAnalyzeWorkflow:
			blob.quick_analyze_workflow ?? DEFAULT_USER_SETTINGS.quickAnalyzeWorkflow,
		showIds: blob.show_ids ?? DEFAULT_USER_SETTINGS.showIds,
		showVersions: blob.show_versions ?? DEFAULT_USER_SETTINGS.showVersions,
		skipQuickAnalyzeDialog:
			blob.skip_quick_analyze_dialog ??
			DEFAULT_USER_SETTINGS.skipQuickAnalyzeDialog,
		avatarSource: AVATAR_SOURCES.includes(blob.avatar_source as AvatarSource)
			? (blob.avatar_source as AvatarSource)
			: DEFAULT_USER_SETTINGS.avatarSource,
	};
}

/** Map the camelCase model to the shape written to the `settings` column. */
function toStoredAccountSettings(
	settings: AccountSettings,
): StoredAccountSettings {
	return {
		pathoscope_columns: settings.pathoscopeColumns,
		prefer_abbreviation: settings.preferAcronym,
		quick_analyze_workflow: settings.quickAnalyzeWorkflow,
		show_ids: settings.showIds,
		show_versions: settings.showVersions,
		skip_quick_analyze_dialog: settings.skipQuickAnalyzeDialog,
		avatar_source: settings.avatarSource,
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
	 * The user administration list reads pending accounts through
	 * {@link findAdministeredUsers} instead.
	 */
	lifecycleState?: AccountLifecycleState | "any";
};

/** Values accepted when creating a user. */
export type CreateUserValues = {
	handle: string;
	password: string;
	forceReset: boolean;
	email?: string;
	emailVerified?: boolean;
	administratorRole?: AdministratorRoleName | null;
};

/** Values accepted when creating a pending user. */
export type CreatePendingUserValues = {
	email: string;
	administratorRole?: AdministratorRoleName | null;
	groups?: number[];
	primaryGroup?: number | null;
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
};

/** A completed password change. */
export type ChangePasswordResult = {
	account: Account;
	migrated: boolean;
};

/** Thrown when a requested user does not exist. */
export class UserNotFoundError extends AppError {}

/** Thrown when a supplied password does not match the user's stored one. */
export class InvalidPasswordError extends AppError {}

/** Thrown when a user handle conflicts with an existing user. */
export class UserConflictError extends AppError {}

/** Thrown when a user's group assignment names an invalid group. */
export class GroupMembershipError extends AppError {}

function mapUnknownGroup(error: unknown): never {
	if (isForeignKeyViolation(error, ["user_groups_group_id_fkey"])) {
		throw new GroupMembershipError();
	}
	throw error;
}

/**
 * Thrown when an operation that assumes a usable account is aimed at one that
 * has not completed setup.
 */
export class PendingAccountError extends AppError {}

/** Thrown when first-instance creation runs after any user already exists. */
export class FirstAdministratorExistsError extends AppError {}

// The settings every newly created account starts with, and the fallback for
// any key a stored blob is missing.
const DEFAULT_USER_SETTINGS: AccountSettings = {
	pathoscopeColumns: [...PATHOSCOPE_COLUMNS],
	preferAcronym: false,
	skipQuickAnalyzeDialog: true,
	showIds: true,
	showVersions: true,
	quickAnalyzeWorkflow: "pathoscope",
	avatarSource: "initials",
};

// Every member of the administrator-role enum, with its capitalized name and
// description.
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
		conditions.push(ilike(usersTable.handle, toSearchPattern(term)));
	}
	const filter = and(...conditions);

	const [[totalRow], [foundRow], rows] = await Promise.all([
		db.select({ value: count() }).from(usersTable),
		db.select({ value: count() }).from(usersTable).where(filter),
		db
			.select()
			.from(usersTable)
			.where(filter)
			.orderBy(asc(sql`lower(${usersTable.handle})`))
			.limit(perPage)
			.offset(getPageOffset(page, perPage)),
	]);

	const foundCount = foundRow?.value ?? 0;

	return {
		items: await assembleUsers(db, rows),
		foundCount,
		totalCount: totalRow?.value ?? 0,
		page,
		pageCount: getPageCount(foundCount, perPage),
		perPage,
	};
}

/** Filters and ordering accepted by the user administration list. */
export type FindAdministeredUsersOptions = {
	term?: string;
	page?: number;
	perPage?: number;
	/** The account states to return. Empty returns every state. */
	statuses?: UserStatus[];
	/** The roles to return, where `"none"` means no administrator role. Empty returns every role. */
	roles?: UserRoleFilter[];
	sort?: UserSortField;
	direction?: SortDirection;
};

function getStatusCondition(status: UserStatus): SQL | undefined {
	if (status === "deactivated") {
		return eq(usersTable.active, false);
	}

	return and(
		eq(usersTable.active, true),
		eq(usersTable.lifecycleState, status === "invited" ? "pending" : "normal"),
	);
}

function getRoleCondition(roles: UserRoleFilter[]): SQL | undefined {
	const named = roles.filter((role) => role !== "none");

	return or(
		named.length ? inArray(usersTable.administratorRole, named) : undefined,
		roles.includes("none") ? isNull(usersTable.administratorRole) : undefined,
	);
}

function getSortExpressions(sort: UserSortField, direction: SortDirection) {
	const order = direction === "ascending" ? asc : desc;
	const handle = sql`lower(${usersTable.handle})`;

	switch (sort) {
		case "email":
			// Accounts without an address go last in either direction.
			return [
				asc(sql`${usersTable.email} = ''`),
				order(sql`lower(${usersTable.email})`),
			];
		case "role":
			return [
				order(sql`case ${usersTable.administratorRole}
					when 'full' then 0
					when 'settings' then 1
					when 'users' then 2
					when 'base' then 3
					else 4 end`),
			];
		case "status":
			return [
				order(sql`case
					when not ${usersTable.active} then 2
					when ${usersTable.lifecycleState} = 'pending' then 1
					else 0 end`),
			];
		default:
			// Pending accounts have no handle yet, so they go last in either
			// direction.
			return [asc(sql`${usersTable.handle} = ''`), order(handle)];
	}
}

/**
 * Find users for the user administration list, with their email addresses.
 *
 * Unlike {@link findUsers}, this returns pending and deactivated accounts, so
 * only administrators may call it.
 */
export async function findAdministeredUsers(
	db: Db,
	options: FindAdministeredUsersOptions,
): Promise<AdministeredUserSearchResult> {
	const {
		term = "",
		page = 1,
		perPage = 25,
		statuses = [],
		roles = [],
		sort = "handle",
		direction = "ascending",
	} = options;

	const filter = and(
		term
			? or(
					ilike(usersTable.handle, toSearchPattern(term)),
					ilike(usersTable.email, toSearchPattern(term)),
				)
			: undefined,
		statuses.length ? or(...statuses.map(getStatusCondition)) : undefined,
		roles.length ? getRoleCondition(roles) : undefined,
	);
	const [[totalRow], [foundRow], rows] = await Promise.all([
		db.select({ value: count() }).from(usersTable),
		db.select({ value: count() }).from(usersTable).where(filter),
		db
			.select()
			.from(usersTable)
			.where(filter)
			.orderBy(
				...getSortExpressions(sort, direction),
				...getSortExpressions("handle", "ascending"),
				asc(usersTable.id),
			)
			.limit(perPage)
			.offset(getPageOffset(page, perPage)),
	]);

	const foundCount = foundRow?.value ?? 0;
	const users = await assembleUsers(db, rows);

	return {
		items: users.map((user, index) => ({
			...user,
			email: rows[index]?.email ?? "",
		})),
		foundCount,
		totalCount: totalRow?.value ?? 0,
		page,
		pageCount: getPageCount(foundCount, perPage),
		perPage,
	};
}

/** Read a user for the administrator detail view, with their TOTP state. */
export async function getUser(
	db: Db,
	userId: number,
): Promise<AdministeredUserDetail> {
	const [row] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!row) {
		throw new UserNotFoundError();
	}

	const user = takeFirstOrThrow(await assembleUsers(db, [row]));

	return { ...user, twoFactorEnabled: row.twoFactorEnabled ?? false };
}

/**
 * Get the email whose Gravatar represents the user with `handle`, or `null`
 * when the user has none to show.
 *
 * Only an active user who chose Gravatar has one.
 */
export async function getGravatarEmail(
	db: Db,
	handle: string,
): Promise<string | null> {
	const [row] = await db
		.select({
			active: usersTable.active,
			email: usersTable.email,
			settings: usersTable.settings,
		})
		.from(usersTable)
		.where(
			and(
				sql`lower(${usersTable.handle}) = lower(${handle})`,
				sql`${usersTable.handle} <> ''`,
			),
		)
		.limit(1);

	if (
		!row?.active ||
		fromStoredAccountSettings(row.settings).avatarSource !== "gravatar"
	) {
		return null;
	}

	return normalizeEmail(row.email) || null;
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
 * Read the signed-in user's email verification and TOTP state.
 *
 * The recovery-code count is not here. Better Auth holds the codes encrypted,
 * so the caller counts them through Better Auth.
 */
export async function getAccountSecurity(
	db: Db,
	userId: number,
): Promise<Omit<AccountSecurity, "recoveryCodesRemaining">> {
	const [[row], [pending], [policy]] = await Promise.all([
		db
			.select({
				email: usersTable.email,
				emailVerified: usersTable.emailVerified,
				twoFactorEnabled: usersTable.twoFactorEnabled,
			})
			.from(usersTable)
			.where(eq(usersTable.id, userId))
			.limit(1),
		db
			.select({ candidateEmail: setupTokens.candidateEmail })
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.userId, userId),
					eq(setupTokens.purpose, "email_verification"),
					isNull(setupTokens.consumedAt),
					isNull(setupTokens.supersededAt),
					sql`${setupTokens.expiresAt} > timezone('utc', clock_timestamp())`,
				),
			)
			.limit(1),
		db
			.select({ mfaPolicy: settingsTable.mfaPolicy })
			.from(settingsTable)
			.where(eq(settingsTable.id, 1))
			.limit(1),
	]);

	if (!row) {
		throw new UserNotFoundError();
	}

	// A token for the current address verifies it and changes nothing.
	const candidateEmail = pending?.candidateEmail ?? null;
	const pendingEmail =
		candidateEmail && candidateEmail !== normalizeEmail(row.email)
			? candidateEmail
			: null;

	return {
		emailVerified: row.emailVerified,
		mfaRequired: policy?.mfaPolicy === "required",
		pendingEmail,
		twoFactorEnabled: row.twoFactorEnabled ?? false,
	};
}

const STORED_ACCOUNT_SETTINGS_KEYS: {
	[K in keyof AccountSettings]: keyof StoredAccountSettings;
} = {
	pathoscopeColumns: "pathoscope_columns",
	preferAcronym: "prefer_abbreviation",
	quickAnalyzeWorkflow: "quick_analyze_workflow",
	showIds: "show_ids",
	showVersions: "show_versions",
	skipQuickAnalyzeDialog: "skip_quick_analyze_dialog",
	avatarSource: "avatar_source",
};

/**
 * Merge a partial change into the signed-in user's own settings and return
 * the settings that result.
 *
 * The merge happens in one statement, so two changes to different keys made
 * at the same time cannot overwrite each other.
 */
export async function updateAccountSettings(
	db: Db,
	userId: number,
	settings: Partial<AccountSettings>,
): Promise<AccountSettings> {
	const patch = Object.fromEntries(
		Object.entries(settings)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => [
				STORED_ACCOUNT_SETTINGS_KEYS[key as keyof AccountSettings],
				value,
			]),
	);

	const [row] = await db
		.update(usersTable)
		.set({
			settings: sql`${usersTable.settings} || ${JSON.stringify(patch)}::jsonb`,
		})
		.where(eq(usersTable.id, userId))
		.returning({ settings: usersTable.settings });

	if (!row) {
		throw new UserNotFoundError();
	}

	return fromStoredAccountSettings(row.settings);
}

/**
 * Change the signed-in user's own password, after verifying the one they
 * already hold.
 *
 * The change clears `force_reset` and revokes every Better Auth session in the
 * same transaction. The web boundary signs the caller in again after commit;
 * session cookies remain transport state and never enter the data layer.
 */
export async function changePassword(
	db: Db,
	{ userId, oldPassword, password }: ChangePasswordValues,
): Promise<ChangePasswordResult> {
	const [existing] = await db
		.select({
			authMigratedAt: usersTable.authMigratedAt,
			password: usersTable.password,
		})
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
	// The update matches on the verified hash, not just the id. Nothing held a
	// lock across the read, the bcrypt verify, and the bcrypt hash above, and at
	// cost 12 that gap is hundreds of milliseconds — long enough for an
	// administrator responding to a compromise to reset this password or set
	// force_reset in between. Without the guard we would overwrite their newer
	// credential, clear the flag they just set, and hand the attacker a fresh
	// session. Matching on the old hash makes the loser of that race update
	// nothing, and an unchanged password is exactly the case the caller already
	// reports as bad credentials.
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
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

		if (existing.authMigratedAt !== null) {
			await updateAuthPassword(tx, userId, hashed);
		}

		await tx.delete(authSessions).where(eq(authSessions.userId, userId));
		await invalidateUserSessions(tx, userId);
		await supersedeSetupTokens(tx, userId, "password_recovery");
		await supersedeSetupTokens(tx, userId, "administrator_recovery");
	});

	// An administrator with this user's detail open sees last_password_change and
	// force_reset, both of which just moved, so the change is published the way
	// updateUser publishes its own.
	await emit("users", userId, "update");

	return {
		account: await getAccount(db, userId),
		migrated: existing.authMigratedAt !== null,
	};
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
 * The administrator role and group memberships are set here. The handle stays
 * empty so the invitee can choose it during acceptance.
 * The credential is also missing: `password` stays null and `lifecycle_state` is `pending`,
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
export async function createPendingUserInTransaction(
	tx: DbOrTx,
	values: CreatePendingUserValues,
): Promise<number> {
	const groupIds = Array.from(new Set(values.groups ?? []));
	if (
		values.primaryGroup !== undefined &&
		values.primaryGroup !== null &&
		!groupIds.includes(values.primaryGroup)
	) {
		throw new GroupMembershipError();
	}

	if (groupIds.length > 0) {
		const existing = await tx
			.select({ id: groupsTable.id })
			.from(groupsTable)
			.where(inArray(groupsTable.id, groupIds));
		if (existing.length !== groupIds.length) {
			throw new GroupMembershipError();
		}
	}

	const email = normalizeEmail(values.email);
	const now = new Date();
	await claimEmail(tx, 0, email);
	const row = takeFirstOrThrow(
		await tx
			.insert(usersTable)
			.values({
				authMigratedAt: now,
				email,
				handle: "",
				lifecycleState: "pending",
				administratorRole: values.administratorRole ?? null,
				lastPasswordChange: now,
				legacyId: null,
				settings: toStoredAccountSettings(DEFAULT_USER_SETTINGS),
			})
			.returning({ id: usersTable.id }),
	);

	await tx.insert(authAccounts).values({
		accountId: String(row.id),
		providerId: CREDENTIAL_PROVIDER_ID,
		userId: row.id,
		password: null,
		createdAt: now,
		updatedAt: now,
	});

	if (groupIds.length > 0) {
		await tx
			.insert(userGroupsTable)
			.values(
				groupIds.map((groupId) => ({
					userId: row.id,
					groupId,
					primary: groupId === values.primaryGroup,
				})),
			)
			.catch(mapUnknownGroup);
	}

	return row.id;
}

export async function createUser(
	db: Db,
	values: CreateUserValues,
): Promise<User> {
	const password = await hashPassword(values.password);

	try {
		const userId = await db.transaction((tx) =>
			createUserInTransaction(tx, values, password),
		);

		await emit("users", userId, "create");

		return getUser(db, userId);
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new UserConflictError();
		}
		throw error;
	}
}

/** Insert a normal user and Better Auth credential in the caller's transaction. */
export async function createUserInTransaction(
	tx: DbOrTx,
	values: CreateUserValues,
	password: Buffer,
): Promise<number> {
	const now = new Date();
	const email = values.email ? normalizeEmail(values.email) : "";
	if (email) {
		await claimEmail(tx, 0, email);
	}
	const row = takeFirstOrThrow(
		await tx
			.insert(usersTable)
			.values({
				authMigratedAt: now,
				handle: values.handle,
				username: values.handle.toLowerCase(),
				displayUsername: values.handle,
				email,
				emailVerified: values.emailVerified ?? false,
				password,
				forceReset: values.forceReset,
				administratorRole: values.administratorRole ?? null,
				lastPasswordChange: now,
				legacyId: null,
				settings: toStoredAccountSettings(DEFAULT_USER_SETTINGS),
			})
			.returning({ id: usersTable.id }),
	);

	await tx.insert(authAccounts).values({
		accountId: String(row.id),
		providerId: CREDENTIAL_PROVIDER_ID,
		userId: row.id,
		password: password.toString("utf8"),
		createdAt: now,
		updatedAt: now,
	});

	return row.id;
}

/** Inputs for transactionally creating the first instance administrator. */
export type CreateFirstAdministratorInput = {
	handle: string;
	email: string;
	password: string;
	deliveryAvailable: boolean;
	getVerificationUrl: (token: string) => string;
};

/** Create exactly one first administrator and optional verification message. */
export async function createFirstAdministrator(
	db: Db,
	input: CreateFirstAdministratorInput,
): Promise<{ user: User; emailVerificationRequired: boolean }> {
	// The endpoint is unauthenticated, so refuse before the costly hash. The
	// locked count below still decides concurrent attempts.
	const [anyUser] = await db
		.select({ id: usersTable.id })
		.from(usersTable)
		.limit(1);
	if (anyUser) {
		throw new FirstAdministratorExistsError();
	}

	const password = await hashPassword(input.password);
	const result = await db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext('first_instance_bootstrap'))`,
		);
		const [existing] = await tx.select({ value: count() }).from(usersTable);
		if ((existing?.value ?? 0) > 0) {
			throw new FirstAdministratorExistsError();
		}

		const userId = await createUserInTransaction(
			tx,
			{
				handle: input.handle,
				email: input.email,
				password: input.password,
				forceReset: false,
				administratorRole: "full",
				emailVerified: false,
			},
			password,
		);

		let emailVerificationRequired = false;
		if (input.deliveryAvailable) {
			const verification = await queueEmailVerificationInTransaction(tx, {
				userId,
				candidateEmail: normalizeEmail(input.email),
				sourceEmail: normalizeEmail(input.email),
				handle: input.handle,
				getVerificationUrl: input.getVerificationUrl,
			});
			emailVerificationRequired = verification.queued;
		}
		return { userId, emailVerificationRequired };
	});

	await emit("users", result.userId, "create");
	return {
		user: await getUser(db, result.userId),
		emailVerificationRequired: result.emailVerificationRequired,
	};
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
	if (
		(values.password !== undefined || values.handle !== undefined) &&
		existing.lifecycleState === "pending"
	) {
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
		if (
			values.active === false ||
			values.password !== undefined ||
			values.forceReset === true
		) {
			await lockUserSetupCredentials(tx, userId);
		}
		if (Object.keys(patch).length > 0) {
			try {
				await tx.update(usersTable).set(patch).where(eq(usersTable.id, userId));

				if (values.handle !== undefined) {
					await tx
						.update(usersTable)
						.set({
							username: values.handle.toLowerCase(),
							displayUsername: values.handle,
						})
						.where(
							and(
								eq(usersTable.id, userId),
								isNotNull(usersTable.authMigratedAt),
							),
						);
				}
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new UserConflictError();
				}
				throw error;
			}
		}

		if (values.password !== undefined && patch.password) {
			await updateAuthPassword(tx, userId, patch.password);
		}

		if (values.handle !== undefined) {
			await updateAuthUsername(tx, userId, values.handle);
		}

		if (revokeSessions) {
			await tx.delete(authSessions).where(eq(authSessions.userId, userId));
			await invalidateUserSessions(tx, userId);
		}
		if (values.password !== undefined || values.forceReset === true) {
			await supersedeSetupTokens(tx, userId, "password_recovery");
			await supersedeSetupTokens(tx, userId, "administrator_recovery");
		}

		if (values.active === false) {
			await invalidateUserSetupTokens(tx, userId);
			await invalidateUserSetupSessions(tx, userId);
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
				await tx
					.insert(userGroupsTable)
					.values(
						uniqueGroupIds.map((groupId) => ({
							userId,
							groupId,
							primary: groupId === currentPrimary,
						})),
					)
					.catch(mapUnknownGroup);
			}
		}

		if (values.primaryGroup === null) {
			await tx
				.update(userGroupsTable)
				.set({ primary: false })
				.where(eq(userGroupsTable.userId, userId));
		} else if (values.primaryGroup !== undefined) {
			await tx
				.update(userGroupsTable)
				.set({ primary: false })
				.where(eq(userGroupsTable.userId, userId));

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
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		const [row] = await tx
			.update(usersTable)
			.set({ administratorRole: role })
			.where(eq(usersTable.id, userId))
			.returning({ id: usersTable.id });
		if (!row) {
			throw new UserNotFoundError();
		}
		await supersedeSetupTokens(tx, userId, "administrator_recovery");
	});

	await emit("users", userId, "update");

	return getUser(db, userId);
}
