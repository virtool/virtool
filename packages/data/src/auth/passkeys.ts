import { eq } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { authPasskeys } from "../db/schema/auth";

/** Whether any user already holds a credential with this WebAuthn id. */
export async function isPasskeyCredentialRegistered(
	db: DbOrTx,
	credentialId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: authPasskeys.id })
		.from(authPasskeys)
		.where(eq(authPasskeys.credentialID, credentialId))
		.limit(1);

	return row !== undefined;
}
