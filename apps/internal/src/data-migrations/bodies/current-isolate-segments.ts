import { type DataMigrationArgs, defineAudit } from "../define";

type DuplicateSegment = {
	otu_id: string;
	isolate_id: string;
	segment_id: string;
	count: number;
};

async function audit({ client, signal, report }: DataMigrationArgs) {
	signal.throwIfAborted();
	const duplicates = await client<DuplicateSegment[]>`
		SELECT otu_id, isolate_id, segment_id, count(*)::integer AS count
		FROM public.otu_sequence_versions
		WHERE last_version IS NULL
		GROUP BY otu_id, isolate_id, segment_id
		HAVING count(*) > 1
		ORDER BY otu_id, isolate_id, segment_id
	`;
	for (const duplicate of duplicates) {
		signal.throwIfAborted();
		report({
			code: "duplicate_current_isolate_segment",
			subject: `otu:${duplicate.otu_id}`,
			detail: {
				isolateId: duplicate.isolate_id,
				segmentId: duplicate.segment_id,
				count: duplicate.count,
			},
		});
	}
	return { duplicateSegments: duplicates.length };
}

/** Audit paired with current isolate/segment uniqueness. */
export const currentIsolateSegments = defineAudit({
	key: "current_isolate_segments",
	version: 1,
	migrationTag: "0041_careless_nitro",
	kind: "audit",
	description: "report duplicate current isolate segments",
	run: audit,
});
