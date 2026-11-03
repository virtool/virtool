import { randomBytes } from "node:crypto";
import * as argon2 from "@node-rs/argon2";
import { z } from "zod";
import { type BatchArgs, defineBackfill } from "../define";

const HASH_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const cursorSchema = z.object({
	afterUserId: z.number().int().nonnegative(),
	phase: z.enum(["migrated_users", "legacy_audit"]),
});

type Cursor = z.infer<typeof cursorSchema>;

type FlaggedUser = {
	id: number;
	password: Buffer | null;
};

type CredentialAccount = {
	id: string;
	password: string | null;
};

async function runBatch({
	client,
	signal,
	report,
	cursor,
	batchSize,
}: BatchArgs<Cursor>) {
	signal.throwIfAborted();
	if (cursor.phase === "legacy_audit") {
		const legacyUsers = await client<{ id: number }[]>`
			SELECT id FROM public.users
			WHERE force_reset = true AND auth_migrated_at IS NULL
			ORDER BY id
		`;
		for (const user of legacyUsers) {
			signal.throwIfAborted();
			report({
				code: "legacy_forced_password_reset",
				subject: `user:${user.id}`,
			});
		}
		return null;
	}

	return client.begin(async function migrateBatch(sql) {
		const users = await sql<FlaggedUser[]>`
			SELECT id, password FROM public.users
			WHERE force_reset = true
				AND auth_migrated_at IS NOT NULL
				AND id > ${cursor.afterUserId}
			ORDER BY id
			LIMIT ${batchSize}
			FOR UPDATE
		`;
		if (users.length === 0) {
			return {
				cursor: { afterUserId: cursor.afterUserId, phase: "legacy_audit" },
				processed: 0,
			};
		}

		for (const user of users) {
			signal.throwIfAborted();
			const accounts = await sql<CredentialAccount[]>`
				SELECT id, password FROM public.auth_accounts
				WHERE provider_id = 'credential' AND user_id = ${user.id}
					AND account_id = ${String(user.id)}
				FOR UPDATE
			`;
			const [account] = accounts;
			if (accounts.length !== 1 || !account || account.password === null) {
				report({
					code: "forced_reset_credential_missing",
					subject: `user:${user.id}`,
				});
				continue;
			}

			const secret = randomBytes(32).toString("base64url");
			const password = await argon2.hash(secret, HASH_OPTIONS);
			await sql`
				UPDATE public.auth_accounts
				SET password = ${password}, updated_at = now()
				WHERE id = ${account.id}
			`;
			await sql`
				UPDATE public.users
				SET password = ${Buffer.from(password, "utf8")}, force_reset = false,
					last_password_change = now(), updated_at = now()
				WHERE id = ${user.id} AND force_reset = true
			`;
			await sql`DELETE FROM public.auth_sessions WHERE user_id = ${user.id}`;
			await sql`DELETE FROM public.setup_sessions WHERE user_id = ${user.id}`;
		}

		return {
			cursor: {
				afterUserId: users.at(-1)?.id ?? cursor.afterUserId,
				phase: "migrated_users",
			},
			processed: users.length,
		};
	});
}

/** Replace flagged credentials, then report any flagged legacy identities. */
export const forcedPasswordReset = defineBackfill({
	key: "forced_password_reset",
	version: 1,
	migrationTag: "0045_drop_force_reset",
	kind: "backfill",
	description: "replace flagged migrated-user credentials and audit flagged legacy users",
	batchSize: 10,
	cursor: cursorSchema,
	initialCursor: { afterUserId: 0, phase: "migrated_users" },
	runBatch,
});
