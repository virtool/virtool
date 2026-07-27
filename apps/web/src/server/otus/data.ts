// Reconstruction of joined OTU documents from the hybrid `legacy_otus` and
// `legacy_sequences` tables. Read-only, and only the slice an analysis needs to
// render a hit — the OTU domain proper is still served by Python, which owns
// the schema and every write to it.
//
// This is a faithful port of `virtool.otus.db.join_legacy_otus_in_session`.

import { inArray } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { AppError } from "../errors";

/** A joined OTU document, recovered verbatim from the `data` JSONB column. */
export type OtuDocument = Record<string, unknown>;

/** A sequence document, recovered verbatim from the `data` JSONB column. */
type SequenceDocument = Record<string, unknown>;

/**
 * Thrown when an OTU row's `data` carries no `isolates` array. Every OTU
 * document has one, so this is a data-integrity violation rather than a routine
 * outcome — merging around it would hand back an OTU whose sequences silently
 * vanished.
 */
class MalformedOtuDataError extends AppError {}

// Bucket sequences into the isolates embedded in the OTU document by
// `isolate_id`, the way Python's `merge_otu` does. An isolate with no sequences
// still gets an empty list.
//
// Nothing is mutated. Python deep-copies the OTU before merging; building fresh
// objects instead means no two callers can ever write through the same nested
// isolate, which is what the copy was defending against.
function mergeOtu(
	otu: OtuDocument,
	sequences: SequenceDocument[],
): OtuDocument {
	const isolates = otu.isolates;

	if (!Array.isArray(isolates)) {
		throw new MalformedOtuDataError(
			`OTU ${String(otu._id)} has no isolates array`,
		);
	}

	return {
		...otu,
		isolates: isolates.map((isolate) => {
			const embedded = isolate as Record<string, unknown>;

			return {
				...embedded,
				sequences: sequences.filter(
					(sequence) => sequence.isolate_id === embedded.id,
				),
			};
		}),
	};
}

/**
 * Reconstruct joined OTU documents for `otuIds`, each with its isolates'
 * sequences merged in. OTUs with no row are absent from the returned map, which
 * carries what a missing OTU does.
 *
 * The OTUs are read in one query and their sequences in a second, so the cost is
 * two queries however many OTUs are asked for. A caller with a set of OTUs to
 * join — an analysis formatting a hit per detected OTU — must reach for this
 * rather than looping or fanning out with `Promise.all`, which takes a pool
 * connection per OTU and is what made formatting a pathoscope analysis saturate
 * the pool.
 *
 * Both documents come out of the verbatim `data` JSONB rather than the promoted
 * columns, which are a lossy projection: they carry nothing of `lower_name`, an
 * isolate's fields, or a sequence's `reference`, and normalise `abbreviation`
 * and `segment` on the way in. A joined OTU feeds diffs that address the
 * document as it was written, so anything the projection drops would corrupt a
 * patch rather than merely be absent from it.
 *
 * Returned documents must be treated as read-only; they may share structure with
 * one another and with the documents a patch is built from.
 */
export async function joinLegacyOtus(
	db: DbOrTx,
	otuIds: Iterable<string>,
): Promise<Map<string, OtuDocument>> {
	const ids = [...new Set(otuIds)];

	if (ids.length === 0) {
		return new Map();
	}

	const otuRows = await db
		.select({ id: legacyOtus.id, data: legacyOtus.data })
		.from(legacyOtus)
		.where(inArray(legacyOtus.id, ids));

	if (otuRows.length === 0) {
		return new Map();
	}

	const sequenceRows = await db
		.select({ otuId: legacySequences.otu_id, data: legacySequences.data })
		.from(legacySequences)
		.where(
			inArray(
				legacySequences.otu_id,
				otuRows.map((row) => row.id),
			),
		)
		// Ascending `position` within each OTU reproduces the natural order Mongo's
		// unsorted cursor returned sequences in, which is the order the diffs that
		// address an isolate's sequence list by index were written against. A NULL
		// position on an unbackfilled row is deliberately not sorted around — it
		// takes Postgres' default NULLS LAST, exactly as Python's plain ascending
		// sort does. Shuffling such an OTU to tidy it would misapply every indexed
		// diff, which is the failure `position` exists to prevent.
		.orderBy(legacySequences.otu_id, legacySequences.position);

	const sequencesByOtu = new Map<string, SequenceDocument[]>();

	for (const row of sequenceRows) {
		const forOtu = sequencesByOtu.get(row.otuId) ?? [];
		forOtu.push(row.data);
		sequencesByOtu.set(row.otuId, forOtu);
	}

	return new Map(
		otuRows.map((row) => [
			row.id,
			// `data` is used as it comes out of the column. Python parses
			// `created_at` back from its ISO string to a datetime because the rest of
			// its codebase re-encodes the document to BSON; nothing here does. This
			// document is about to be diff-patched — and a `created_at` inside a diff
			// is an ISO string too, because the diffs were themselves serialized to
			// JSONB — and then read for OTU, isolate and sequence metadata that never
			// includes `created_at`. Parsing it would put a `Date` into a document
			// that has to stay plain JSON to survive both the patch and the trip back
			// to the browser, in exchange for a field no reader looks at.
			mergeOtu(row.data, sequencesByOtu.get(row.id) ?? []),
		]),
	);
}
