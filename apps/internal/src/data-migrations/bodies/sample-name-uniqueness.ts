import { type DataMigrationArgs, defineAudit } from "../define";

type DuplicateSampleName = {
	name: string;
	count: number;
};

async function audit({ client, signal, report }: DataMigrationArgs) {
	signal.throwIfAborted();
	const duplicates = await client<DuplicateSampleName[]>`
		SELECT name, count(*)::integer AS count
		FROM public.legacy_samples
		GROUP BY name
		HAVING count(*) > 1
		ORDER BY name
	`;

	for (const duplicate of duplicates) {
		signal.throwIfAborted();
		report({
			code: "duplicate_sample_name",
			subject: `sample-name:${duplicate.name}`,
			detail: { count: duplicate.count },
		});
	}

	return { duplicateNames: duplicates.length };
}

/** Audit paired with the migration that enforces unique sample names. */
export const sampleNameUniqueness = defineAudit({
	key: "sample_name_uniqueness",
	version: 1,
	migrationTag: "0039_enforce_sample_name_uniqueness",
	kind: "audit",
	description: "report sample names used by more than one sample",
	run: audit,
});
