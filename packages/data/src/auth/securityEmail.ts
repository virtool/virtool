import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { users } from "../db/schema/users";
import { enqueueEmail } from "../email/outbox";

/** The recipient of a security notice, as the account held it before the change. */
export type SecurityEmailRecipient = {
	email: string;
	emailVerified: boolean;
	handle: string;
};

async function queueSecurityEmail(
	tx: DbOrTx,
	userId: number,
	recipient: SecurityEmailRecipient,
	type: "email_changed" | "password_changed",
): Promise<void> {
	// An unverified address may belong to someone else.
	if (!recipient.emailVerified || recipient.email === "") {
		return;
	}

	await enqueueEmail(tx, {
		idempotencyKey: `${type}/${userId}/${randomUUID()}`,
		recipient: recipient.email,
		template: { type, username: recipient.handle },
	});
}

/** Queue a password-change notice to the account's current address. */
export async function queuePasswordChangedEmail(
	tx: DbOrTx,
	userId: number,
): Promise<void> {
	const [recipient] = await tx
		.select({
			email: users.email,
			emailVerified: users.emailVerified,
			handle: users.handle,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (recipient) {
		await queueSecurityEmail(tx, userId, recipient, "password_changed");
	}
}

/** Queue an email-change notice to the address the account held before. */
export async function queueEmailChangedEmail(
	tx: DbOrTx,
	userId: number,
	previous: SecurityEmailRecipient,
): Promise<void> {
	await queueSecurityEmail(tx, userId, previous, "email_changed");
}
