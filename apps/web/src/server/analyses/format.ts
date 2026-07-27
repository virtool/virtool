// Shape a workflow's raw `results` blob for presentation. Ported from
// `../../../../../virtool/virtool/analyses/format.py`.
//
// This is business logic, not a join simplification. Pathoscope results record
// only per-sequence hit metrics; every OTU, isolate and sequence name,
// accession and length is recovered by taking each detected OTU back to the
// version the analysis saw. NuVs results reference HMM annotations by id and
// have them merged in.

import { inArray, or } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { hmms } from "../db/schema/hmms";
import { AppError } from "../errors";
import {
	type OtuDocument,
	otuSpecifierKey,
	patchOtusToVersions,
} from "../history/data";
import { asArray, asNumber, asRecord, asString } from "./json";
import { type Coordinate, transformCoverageToCoordinates } from "./simplify";

/** Thrown when an analysis's stored results cannot be shaped for presentation. */
export class AnalysisResultsError extends AppError {}

// The raw blob is the worker's contract: its keys stay exactly as the workflow
// wrote them, so it is read structurally rather than through a declared shape.
type RawResults = Record<string, unknown>;

/** A pathoscope sequence, shaped for presentation. */
export type FormattedSequence = {
	id: string;
	accession: unknown;
	align: Coordinate[] | null;
	best: number;
	coverage: number;
	definition: unknown;
	length: number;
	pi: number;
	reads: number;
};

// The hits a single detected OTU accounts for, keyed by the sequence they hit.
function indexHitsBySequence(
	hits: unknown[],
): Map<string, Record<string, unknown>> {
	const bySequence = new Map<string, Record<string, unknown>>();

	for (const hit of hits) {
		const record = asRecord(hit);

		if (record) {
			bySequence.set(asString(record.id), record);
		}
	}

	return bySequence;
}

function formatSequences(
	sequences: unknown[],
	hitsBySequenceId: Map<string, Record<string, unknown>>,
): FormattedSequence[] {
	const formatted: FormattedSequence[] = [];

	for (const entry of sequences) {
		const sequence = asRecord(entry);

		if (!sequence) {
			continue;
		}

		// Sequences inside a patched OTU are Mongo documents, so the identifier is
		// `_id` rather than `id`.
		const sequenceId = asString(sequence._id);
		const hit = hitsBySequenceId.get(sequenceId);

		// A sequence the analysis recorded no hit against is not part of the result.
		if (!hit) {
			continue;
		}

		const final = asRecord(hit.final) ?? {};
		const align = hit.align;

		formatted.push({
			id: sequenceId,
			accession: sequence.accession,
			align: Array.isArray(align)
				? transformCoverageToCoordinates(align as number[])
				: null,
			best: asNumber(final.best, 0),
			coverage: asNumber(hit.coverage, 0),
			definition: sequence.definition,
			length: asString(sequence.sequence ?? "").length,
			pi: asNumber(final.pi, 0),
			reads: asNumber(final.reads, 0),
		});
	}

	return formatted;
}

function formatIsolates(
	isolates: unknown[],
	hitsBySequenceId: Map<string, Record<string, unknown>>,
): Record<string, unknown>[] {
	const formatted: Record<string, unknown>[] = [];

	for (const entry of isolates) {
		const isolate = asRecord(entry);

		if (!isolate) {
			continue;
		}

		const sequences = formatSequences(
			asArray(isolate.sequences),
			hitsBySequenceId,
		);

		// Python gates this on any formatted sequence carrying a `pi` or `final`
		// key. Every sequence it yields always carries `pi`, so the test reduces to
		// "the isolate matched at least one hit" — which is what is written here.
		if (sequences.length > 0) {
			formatted.push({ ...isolate, sequences });
		}
	}

	return formatted;
}

function formatHits(
	otuId: string,
	patchedOtu: OtuDocument,
	hits: unknown[],
): Record<string, unknown> {
	const isolates = asArray(patchedOtu.isolates);

	let maxSequenceLength = 0;

	for (const entry of isolates) {
		for (const sequenceEntry of asArray(asRecord(entry)?.sequences)) {
			const length = asString(asRecord(sequenceEntry)?.sequence ?? "").length;

			if (length > maxSequenceLength) {
				maxSequenceLength = length;
			}
		}
	}

	return {
		id: otuId,
		abbreviation: patchedOtu.abbreviation,
		name: patchedOtu.name,
		isolates: formatIsolates(isolates, indexHitsBySequence(hits)),
		length: maxSequenceLength,
		version: patchedOtu.version,
	};
}

async function formatPathoscope(
	db: DbOrTx,
	results: RawResults,
): Promise<RawResults> {
	const hitsByOtu = new Map<
		string,
		{ otuId: string; version: number; hits: unknown[] }
	>();

	for (const entry of asArray(results.hits)) {
		const hit = asRecord(entry);
		const otu = asRecord(hit?.otu);

		if (!hit || !otu) {
			throw new AnalysisResultsError("Pathoscope hit is missing its OTU");
		}

		const otuId = asString(otu.id);
		const version = asNumber(otu.version, Number.NaN);

		if (!Number.isInteger(version)) {
			throw new AnalysisResultsError(
				`Pathoscope hit for OTU ${otuId} has no integer version`,
			);
		}

		const key = otuSpecifierKey(otuId, version);
		const group = hitsByOtu.get(key) ?? { otuId, version, hits: [] };

		group.hits.push(hit);
		hitsByOtu.set(key, group);
	}

	// One batched read for every detected OTU. Patching them one at a time issues
	// a query and takes a pool connection per hit, which saturates both on a
	// result with a few hundred of them.
	const patched = await patchOtusToVersions(
		db,
		[...hitsByOtu.values()].map(({ otuId, version }) => ({ otuId, version })),
	);

	const formattedHits = [...hitsByOtu].map(([key, { otuId, hits }]) => {
		const patchedOtu = patched.get(key);

		// An analysis that recorded a hit against an OTU version proves the OTU
		// existed at it. A null here is a corrupted history, not a routine miss.
		if (!patchedOtu) {
			throw new AnalysisResultsError(
				`OTU ${otuId} could not be patched to the version the analysis saw`,
			);
		}

		return formatHits(otuId, patchedOtu, hits);
	});

	return { ...results, hits: formattedHits };
}

async function formatNuvs(
	db: DbOrTx,
	results: RawResults,
): Promise<RawResults> {
	const sequences = asArray(results.hits);

	const hitIds = new Set<string>();

	for (const sequence of sequences) {
		for (const orf of asArray(asRecord(sequence)?.orfs)) {
			for (const hit of asArray(asRecord(orf)?.hits)) {
				const id = asRecord(hit)?.hit;

				if (id !== undefined && id !== null) {
					hitIds.add(asString(id));
				}
			}
		}
	}

	if (hitIds.size === 0) {
		return results;
	}

	// An annotation written before the Postgres migration is referenced by its
	// Mongo string id, one written since by its integer id. A Mongo id is
	// alphanumeric, so it can be all digits, and nothing about the string itself
	// distinguishes that from a modern id. Every stored id is therefore matched
	// against `legacy_id`, and those that also fit a Postgres integer against
	// `id` as well.
	const modernIds: number[] = [];

	for (const id of hitIds) {
		const parsed = Number(id);

		if (/^\d+$/.test(id) && Number.isSafeInteger(parsed)) {
			modernIds.push(parsed);
		}
	}

	const filters = [inArray(hmms.legacy_id, [...hitIds])];

	if (modernIds.length > 0) {
		filters.push(inArray(hmms.id, modernIds));
	}

	const rows = await db
		.select({
			id: hmms.id,
			legacy_id: hmms.legacy_id,
			cluster: hmms.cluster,
			families: hmms.families,
			names: hmms.names,
		})
		.from(hmms)
		.where(filters.length === 1 ? filters[0] : or(...filters));

	const annotations = new Map<string, Record<string, unknown>>();

	function annotationOf(row: (typeof rows)[number]) {
		return { cluster: row.cluster, families: row.families, names: row.names };
	}

	// Legacy ids are keyed first so that an all-digit one cannot shadow the
	// annotation a modern id of the same digits names.
	for (const row of rows) {
		if (row.legacy_id !== null) {
			annotations.set(row.legacy_id, annotationOf(row));
		}
	}

	for (const row of rows) {
		annotations.set(String(row.id), annotationOf(row));
	}

	return {
		...results,
		hits: sequences.map((sequence) => {
			const record = asRecord(sequence);

			if (!record) {
				return sequence;
			}

			return {
				...record,
				orfs: asArray(record.orfs).map((orf) => {
					const orfRecord = asRecord(orf);

					if (!orfRecord) {
						return orf;
					}

					return {
						...orfRecord,
						hits: asArray(orfRecord.hits).map((hit) => {
							const hitRecord = asRecord(hit);

							if (!hitRecord) {
								return hit;
							}

							const annotation = annotations.get(asString(hitRecord.hit));

							// A hit naming an annotation that no longer exists means the HMM
							// data was replaced under a stored analysis. Surface it rather
							// than rendering an ORF with no families or names.
							if (!annotation) {
								throw new AnalysisResultsError(
									`HMM annotation ${asString(hitRecord.hit)} not found`,
								);
							}

							return { ...hitRecord, ...annotation };
						}),
					};
				}),
			};
		}),
	};
}

/**
 * Shape an analysis's stored results for presentation, dispatching on its
 * workflow.
 */
export async function formatAnalysis(
	db: DbOrTx,
	workflow: string,
	results: RawResults,
): Promise<RawResults> {
	if (workflow === "nuvs") {
		return formatNuvs(db, results);
	}

	// Matched by substring upstream, which admits historical workflow names like
	// `pathoscope_bowtie`.
	if (workflow.includes("pathoscope")) {
		return formatPathoscope(db, results);
	}

	throw new AnalysisResultsError(`Unknown workflow: ${workflow}`);
}
