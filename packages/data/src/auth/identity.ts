import { and, eq, sql } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { authAccounts } from "../db/schema/auth";
import { users } from "../db/schema/users";

/** The Better Auth provider used for Virtool handle-and-password identities. */
export const CREDENTIAL_PROVIDER_ID = "credential";

/** Keep the Better Auth password copy synchronized with the legacy credential. */
export async function updateAuthPassword(
	db: DbOrTx,
	userId: number,
	password: Buffer,
): Promise<void> {
	await db
		.update(authAccounts)
		.set({ password: password.toString("utf8"), updatedAt: new Date() })
		.where(
			and(
				eq(authAccounts.userId, userId),
				eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
			),
		);
}

/** Keep Better Auth's username fields synchronized with the Virtool handle. */
export async function updateAuthUsername(
	db: DbOrTx,
	userId: number,
	handle: string,
): Promise<void> {
	await db
		.update(users)
		.set({ username: handle.toLowerCase(), displayUsername: handle })
		.where(
			and(
				eq(users.id, userId),
				sql`exists (select 1 from ${authAccounts} where ${authAccounts.userId} = ${userId} and ${authAccounts.providerId} = ${CREDENTIAL_PROVIDER_ID})`,
			),
		);
}
