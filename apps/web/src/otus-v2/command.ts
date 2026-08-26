import {
	type CreateLocalOtuCommandInput,
	type GenbankOtuDraft,
	OtuV2SegmentRule,
} from "@virtool/contracts";

/**
 * Turn a GenBank-derived draft into a complete local `CreateOTU` command.
 *
 * The server returns a draft with no UUIDs; this mints every id and applies the
 * Reference's default segment length tolerance, so the whole aggregate is still
 * assembled on the client before it is written. Every segment is `required`,
 * and each draft segment becomes one plan segment and one isolate sequence.
 */
export function buildCreateOtuCommandFromDraft(
	draft: GenbankOtuDraft,
	defaultSegmentLengthTolerance: number,
): CreateLocalOtuCommandInput {
	const entries = draft.segments.map((segment) => {
		const segmentId = crypto.randomUUID();
		return {
			planSegment: {
				id: segmentId,
				name: segment.name,
				length: segment.length,
				lengthTolerance: defaultSegmentLengthTolerance,
				rule: OtuV2SegmentRule.required,
			},
			sequence: {
				id: crypto.randomUUID(),
				definition: segment.definition,
				sequence: segment.sequence,
				segmentId,
			},
		};
	});

	return {
		type: "CreateOTU",
		schemaVersion: 1,
		otuId: crypto.randomUUID(),
		expectedVersion: 0,
		payload: {
			molecule: draft.molecule,
			plan: {
				id: crypto.randomUUID(),
				segments: entries.map((entry) => entry.planSegment),
			},
			taxonomy: {
				kind: "local",
				identityId: crypto.randomUUID(),
				name: draft.taxonomy.name,
				acronym: draft.taxonomy.acronym,
			},
			promotedAccessions: [],
			isolate: {
				id: crypto.randomUUID(),
				name: draft.isolate,
				sequences: entries.map((entry) => entry.sequence),
			},
		},
	};
}
