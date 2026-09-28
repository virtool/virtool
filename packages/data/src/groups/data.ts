import {
	emptyPermissions,
	type Group,
	type GroupMinimal,
	type GroupSearchResult,
	type Permissions,
	type UserNested,
} from "@virtool/contracts";
import { asc, count, eq, ilike, sql } from "drizzle-orm";
import type { PostgresError } from "postgres";
import { getPageCount, getPageOffset } from "../db/pagination";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	type GroupRow,
	groups as groupsTable,
	userGroups as userGroupsTable,
} from "../db/schema/groups";
import { users as usersTable } from "../db/schema/users";
import { toSearchPattern } from "../db/search";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** Partial values accepted when updating a group. */
export type GroupUpdateValues = {
	name?: string;
	permissions?: Partial<Permissions>;
};

/** Thrown when a requested group does not exist. */
export class GroupNotFoundError extends AppError {}

/** Thrown when a group name conflicts with an existing group. */
export class GroupConflictError extends AppError {}

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

function toGroupMinimal(row: GroupRow): GroupMinimal {
	return {
		id: row.id,
		legacyId: row.legacyId,
		name: row.name,
	};
}

async function fetchGroupUsers(db: Db, groupId: number): Promise<UserNested[]> {
	const rows = await db
		.select({ id: usersTable.id, handle: usersTable.handle })
		.from(usersTable)
		.innerJoin(userGroupsTable, eq(userGroupsTable.userId, usersTable.id))
		.where(eq(userGroupsTable.groupId, groupId))
		.orderBy(asc(usersTable.handle));

	return rows.map((row) => ({ id: row.id, handle: row.handle }));
}

export async function listGroups(db: Db): Promise<GroupMinimal[]> {
	const rows = await db
		.select()
		.from(groupsTable)
		.orderBy(asc(groupsTable.name));

	return rows.map(toGroupMinimal);
}

export async function findGroups(
	db: Db,
	term: string,
	page: number,
	perPage: number,
): Promise<GroupSearchResult> {
	const filter = term
		? ilike(groupsTable.name, toSearchPattern(term))
		: undefined;

	const [[foundRow], [totalRow], rows] = await Promise.all([
		db.select({ value: count() }).from(groupsTable).where(filter),
		db.select({ value: count() }).from(groupsTable),
		db
			.select()
			.from(groupsTable)
			.where(filter)
			.orderBy(asc(groupsTable.name))
			.limit(perPage)
			.offset(getPageOffset(page, perPage)),
	]);

	const foundCount = foundRow?.value ?? 0;

	return {
		items: rows.map(toGroupMinimal),
		foundCount,
		totalCount: totalRow?.value ?? 0,
		page,
		pageCount: getPageCount(foundCount, perPage),
		perPage,
	};
}

export async function getGroup(db: Db, groupId: number): Promise<Group> {
	const [row] = await db
		.select()
		.from(groupsTable)
		.where(eq(groupsTable.id, groupId));

	if (!row) {
		throw new GroupNotFoundError();
	}

	const users = await fetchGroupUsers(db, row.id);

	return {
		...toGroupMinimal(row),
		permissions: row.permissions,
		users,
	};
}

export async function createGroup(db: Db, name: string): Promise<Group> {
	try {
		const row = takeFirstOrThrow(
			await db
				.insert(groupsTable)
				.values({
					name,
					legacyId: null,
					permissions: emptyPermissions(),
				})
				.returning(),
		);

		await emit("groups", row.id, "create");

		return {
			...toGroupMinimal(row),
			permissions: row.permissions,
			users: [],
		};
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new GroupConflictError();
		}
		throw error;
	}
}

export async function updateGroup(
	db: Db,
	groupId: number,
	values: GroupUpdateValues,
): Promise<Group> {
	// Merge in Postgres so concurrent toggles on the same group can't overwrite
	// each other with a stale copy of the permissions.
	const patch = {
		...(values.name !== undefined && { name: values.name }),
		...(values.permissions !== undefined && {
			permissions: sql`${groupsTable.permissions} || ${JSON.stringify(values.permissions)}::jsonb`,
		}),
	};

	if (Object.keys(patch).length === 0) {
		return getGroup(db, groupId);
	}

	const [row] = await db
		.update(groupsTable)
		.set(patch)
		.where(eq(groupsTable.id, groupId))
		.returning({ id: groupsTable.id })
		.catch((error: unknown) => {
			if (isUniqueViolation(error)) {
				throw new GroupConflictError();
			}
			throw error;
		});

	if (!row) {
		throw new GroupNotFoundError();
	}

	await emit("groups", groupId, "update");

	return getGroup(db, groupId);
}

export async function deleteGroup(db: Db, groupId: number): Promise<void> {
	const [row] = await db
		.delete(groupsTable)
		.where(eq(groupsTable.id, groupId))
		.returning({ id: groupsTable.id });

	if (!row) {
		throw new GroupNotFoundError();
	}

	await emit("groups", row.id, "delete");
}
