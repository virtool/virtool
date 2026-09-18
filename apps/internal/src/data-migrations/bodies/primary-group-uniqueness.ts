import { type DataMigrationArgs, defineAudit } from "../define";

type DuplicatePrimaryGroup = {
	user_id: number;
	count: number;
};

async function audit({ client, signal, report }: DataMigrationArgs) {
	signal.throwIfAborted();
	const duplicates = await client<DuplicatePrimaryGroup[]>`
		SELECT user_id, count(*)::integer AS count
		FROM public.user_groups
		WHERE "primary" IS TRUE
		GROUP BY user_id
		HAVING count(*) > 1
		ORDER BY user_id
	`;
	for (const duplicate of duplicates) {
		signal.throwIfAborted();
		report({
			code: "multiple_primary_groups",
			subject: `user:${duplicate.user_id}`,
			detail: { count: duplicate.count },
		});
	}

	return { usersWithMultiplePrimaryGroups: duplicates.length };
}

/** Audit paired with the migration that enforces one primary group per user. */
export const primaryGroupUniqueness = defineAudit({
	key: "primary_group_uniqueness",
	version: 1,
	migrationTag: "0032_enforce_primary_group_uniqueness",
	kind: "audit",
	description: "report users assigned to multiple primary groups",
	run: audit,
});
