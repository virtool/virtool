import { emptyPermissions, type Permissions } from "@virtool/contracts";
import type { Db } from "../../db/pg";
import { takeFirstOrThrow } from "../../db/rows";
import { groups, userGroups } from "../../db/schema/groups";

/**
 * A group granting nothing. Spread it to build a group that grants one thing,
 * and assert against it to prove a group still grants nothing.
 */
export const NO_PERMISSIONS: Permissions = emptyPermissions();

/**
 * Insert a group granting no permissions unless told otherwise, and return its
 * id.
 *
 * `name` is unique, so a test seeding a second group must pass a distinct one.
 */
export async function seedGroup(
	db: Db,
	{
		name = "technicians",
		permissions = {},
	}: { name?: string; permissions?: Partial<Permissions> } = {},
): Promise<number> {
	const row = takeFirstOrThrow(
		await db
			.insert(groups)
			.values({
				legacyId: null,
				name,
				permissions: { ...NO_PERMISSIONS, ...permissions },
			})
			.returning({ id: groups.id }),
	);

	return row.id;
}

/** Add a user to a group, granting them its permissions. */
export async function addToGroup(
	db: Db,
	userId: number,
	groupId: number,
): Promise<void> {
	await db.insert(userGroups).values({ groupId, userId });
}
