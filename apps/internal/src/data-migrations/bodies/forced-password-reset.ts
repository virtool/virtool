import { randomBytes } from "node:crypto";
import * as argon2 from "@node-rs/argon2";
import { z } from "zod";
import { type BatchArgs, type BatchResult, defineBackfill } from "../define";

const HASH_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const EMAIL_TEMPLATE_VERSION = 3;

const cursorSchema = z.object({
	afterUserId: z.number().int().nonnegative(),
});

type Cursor = z.infer<typeof cursorSchema>;

type FlaggedUser = {
	id: number;
	email: string;
	emailVerified: boolean;
	handle: string;
};

async function runBatch({
	client,
	signal,
	cursor,
	batchSize,
}: BatchArgs<Cursor>): Promise<BatchResult<Cursor> | null> {
	signal.throwIfAborted();

	return client.begin(async function replaceBatch(sql) {
		const users = await sql<FlaggedUser[]>`
			SELECT id, email, email_verified AS "emailVerified", handle
			FROM public.users
			WHERE force_reset = true AND id > ${cursor.afterUserId}
			ORDER BY id
			LIMIT ${batchSize}
			FOR UPDATE
		`;
		if (users.length === 0) {
			return null;
		}

		const [settings] = await sql<{ emailEnabled: boolean }[]>`
			SELECT email_enabled AS "emailEnabled" FROM public.settings WHERE id = 1
		`;

		for (const user of users) {
			signal.throwIfAborted();
			const secret = randomBytes(32).toString("base64url");
			const password = await argon2.hash(secret, HASH_OPTIONS);

			// A legacy user has no credential account yet. Account migration later
			// copies users.password into one.
			await sql`
				UPDATE public.auth_accounts
				SET password = ${password}, updated_at = timezone('utc', clock_timestamp())
				WHERE provider_id = 'credential' AND user_id = ${user.id}
					AND account_id = ${String(user.id)} AND password IS NOT NULL
			`;
			await sql`
				UPDATE public.users
				SET password = ${Buffer.from(password, "utf8")}, force_reset = false,
					last_password_change = timezone('utc', clock_timestamp()),
					updated_at = timezone('utc', clock_timestamp())
				WHERE id = ${user.id}
			`;
			await sql`DELETE FROM public.auth_sessions WHERE user_id = ${user.id}`;
			await sql`DELETE FROM public.setup_sessions WHERE user_id = ${user.id}`;

			// An unverified address may belong to someone else.
			if (settings?.emailEnabled && user.emailVerified && user.email !== "") {
				const template = { type: "password_changed", username: user.handle };
				await sql`
					INSERT INTO public.email_outbox (
						attempt_count, created_at, idempotency_key, next_attempt_at,
						recipient, status, template, template_version
					) VALUES (
						0, timezone('utc', clock_timestamp()),
						${`password_changed/${user.id}/forced_password_reset`},
						timezone('utc', clock_timestamp()), ${user.email}, 'queued',
						${JSON.stringify(template)}::jsonb,${EMAIL_TEMPLATE_VERSION}
					)
					ON CONFLICT (idempotency_key) DO NOTHING
				`;
			}
		}

		return {
			cursor: { afterUserId: users.at(-1)?.id ?? cursor.afterUserId },
			processed: users.length,
		};
	});
}

/** Replace the password of every user flagged for a forced reset. */
export const forcedPasswordReset = defineBackfill({
	key: "forced_password_reset",
	version: 1,
	migrationTag: "0045_replace_forced_reset_credentials",
	kind: "backfill",
	description: "replace the passwords of users flagged for a forced reset",
	batchSize: 10,
	cursor: cursorSchema,
	initialCursor: { afterUserId: 0 },
	runBatch,
});
