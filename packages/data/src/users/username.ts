import type { AccountLifecycleState, UserIdentity } from "@virtool/contracts";
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Select a `users.username` column as a string, for a query that reaches only
 * set-up accounts.
 *
 * A pending account has no username, but it also has no credential, so it
 * cannot own a resource, act on one, or change a password. A query that reaches
 * a user that way, such as an inner join from a resource to its owner, never
 * sees a pending account. The `username_matches_lifecycle_state` check gives
 * every other account a username.
 */
export function selectSetUpUsername(column: AnyPgColumn): SQL<string> {
	return sql<string>`${column}`;
}

/** The columns {@link getUserIdentity} reads. */
type IdentityRow = {
	id: number;
	lifecycleState: AccountLifecycleState;
	username: string | null;
};

/**
 * Narrow a user row to the identity it holds.
 *
 * The `username_matches_lifecycle_state` check makes a set-up account without a
 * username impossible, so finding one is a broken invariant, not a user error.
 */
export function getUserIdentity(row: IdentityRow): UserIdentity {
	if (row.lifecycleState === "pending") {
		return { id: row.id, lifecycleState: "pending", username: null };
	}
	if (row.username === null) {
		throw new Error(`user ${row.id} is set up but has no username`);
	}
	return { id: row.id, lifecycleState: "normal", username: row.username };
}
