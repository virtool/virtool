import { type DataMigrationArgs, defineAudit } from "../define";

type Finding = {
	id: number;
	code: "invalid_username" | "pending_has_handle" | "username_mismatch";
};

async function audit({ client, signal, report }: DataMigrationArgs) {
	signal.throwIfAborted();
	return client.begin(async function auditTransaction(sql) {
		// Keep handles and usernames stable between the scan and the backfill.
		await sql`SET LOCAL lock_timeout = '5s'`;
		await sql`LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE`;

		// Frozen at 0052: the pattern must not follow the live username rule.
		const findings = await sql<Finding[]>`
			SELECT id, CASE
				WHEN lifecycle_state = 'pending' THEN 'pending_has_handle'
				WHEN lower(handle) !~ '^[a-z0-9_.]{3,30}$' THEN 'invalid_username'
				ELSE 'username_mismatch'
			END AS code
			FROM public.users
			WHERE (lifecycle_state = 'pending' AND handle <> '')
				OR (lifecycle_state <> 'pending' AND lower(handle) !~ '^[a-z0-9_.]{3,30}$')
				OR (lifecycle_state <> 'pending' AND username IS NOT NULL AND username <> lower(handle))
			ORDER BY id
		`;

		for (const finding of findings) {
			signal.throwIfAborted();
			report({ code: finding.code, subject: `user:${finding.id}` });
		}

		// A finding fails the attempt, so nothing is written until every row can
		// be backfilled.
		if (findings.length > 0) {
			return { findings: findings.length, backfilled: 0 };
		}

		signal.throwIfAborted();
		const backfilled = await sql`
			UPDATE public.users
			SET username = CASE WHEN lifecycle_state = 'pending' THEN NULL ELSE lower(handle) END
			WHERE username IS DISTINCT FROM
				CASE WHEN lifecycle_state = 'pending' THEN NULL ELSE lower(handle) END
		`;

		return { findings: 0, backfilled: backfilled.count };
	});
}

/**
 * Backfill paired with the migration that makes `username` the only name a
 * user has.
 *
 * Every set-up account gets its handle folded to lowercase as its username,
 * and every pending account gets none. A fold cannot collide, because handles
 * were already unique ignoring case.
 */
export const usernameBackfill = defineAudit({
	key: "username_backfill",
	version: 1,
	migrationTag: "0052_consolidate_username",
	kind: "audit",
	description: "fold handles into lowercase usernames",
	run: audit,
});
