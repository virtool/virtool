import { and, eq } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { authAccounts } from "../db/schema/auth";

/** The Better Auth provider used for Virtool username-and-password identities. */
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
