import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { authTwoFactors } from "../db/schema/auth";

/** Whether the user has a TOTP enrollment that a first code has confirmed. */
export async function hasVerifiedTotp(
	db: DbOrTx,
	userId: number,
): Promise<boolean> {
	const [row] = await db
		.select({ id: authTwoFactors.id })
		.from(authTwoFactors)
		.where(
			and(eq(authTwoFactors.userId, userId), eq(authTwoFactors.verified, true)),
		)
		.limit(1);

	return row !== undefined;
}
