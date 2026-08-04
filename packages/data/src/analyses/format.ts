// Shape a workflow's `results` blob for presentation. Ported from
// `../../../../../virtool/virtool/analyses/format.py`, then extended to derive
// the display metrics the client used to compute for itself.
//
// This is business logic, not a join simplification. Pathoscope results record
// only per-sequence hit metrics; every OTU, isolate and sequence name,
// accession and length is recovered by taking each detected OTU back to the
// version the analysis saw, and every coverage and depth figure is derived from
// the raw alignments before they are reduced to drawable polylines. NuVs results
// reference HMM annotations by id and have them merged in.

import {
	formatIsolateName,
	type NuvsHit,
	type NuvsOrf,
	type NuvsOrfHit,
	type NuvsResults,
	type PathoscopeHit,
	type PathoscopeIsolate,
	type PathoscopeResults,
	type PathoscopeSequence,
} from "@virtool/contracts";
import { inArray, or } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { hmms } from "../db/schema/hmms";
import { AppError } from "../errors";
import {
	type OtuDocument,
	otuSpecifierKey,
	patchOtusToVersions,
} from "../history/data";
import { asArray, asNumber, asRecord, asString, asText } from "./json";
import {
	coverageOf,
	maxDepthOf,
	medianDepth,
	mergeDepths,
	toDepths,
} from "./metrics";
import {
	compareBySegment,
	groupSequencesIntoSegments,
	readSchemaNames,
	segmentDepths,
} from "./segments";
import { transformCoverageToCoordinates } from "./simplify";

/** Thrown when an analysis's stored results cannot be shaped for presentation. */
export class AnalysisResultsError extends AppError {}

// The raw blob is the worker's contract: its keys stay exactly as the workflow
// wrote them, so it is read structurally rather than through a declared shape.
type RawResults = Record<string, unknown>;

// A formatted sequence carried alongside the raw per-position depths it was
// derived from, and the schema segment it names. The depths themselves never
// reach the wire: every metric that needs them is computed here, and only the
// drawn polyline is sent.
//
// The segment key is the one field it cannot carry: which segment a sequence
// fills is only decided once every isolate has been measured, so the OTU stamps
// it on afterwards.
type MeasuredSequence = {
	depths: number[];
	length: number;
	segment: string | null;
	sequence: Omit<PathoscopeSequence, "segmentKey">;
};

// The same pairing one level up, so an OTU can match its isolates' sequences up
// segment by segment.
//
// `declaredSegments` is read from the isolate's sequences before the unhit ones
// are dropped, and is the only record of them that survives. The OTU turns it
// into the segment keys the isolate is missing once it knows what its segments
// are.
type MeasuredIsolate = {
	declaredSegments: Set<string>;
	depths: number[];
	isolate: Omit<PathoscopeIsolate, "absentSegmentKeys" | "sequences">;
	sequences: MeasuredSequence[];
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
	schemaNames: string[],
): MeasuredSequence[] {
	const measured: MeasuredSequence[] = [];

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
		const length = asText(sequence.sequence).length;

		// An unset segment is an *absent* field in `data`, not a null one — the
		// write path removes the key with the JSONB `-` operator so a stored
		// document stays a faithful lift of the one it was written from. Both read
		// as unassigned here.
		const segment = sequence.segment;

		measured.push({
			depths: toDepths(align, length),
			length,
			segment: typeof segment === "string" && segment !== "" ? segment : null,
			sequence: {
				id: sequenceId,
				accession: asText(sequence.accession),
				align: Array.isArray(align)
					? transformCoverageToCoordinates(align as number[])
					: null,
				best: asNumber(final.best, 0),
				coverage: asNumber(hit.coverage, 0),
				definition: asText(sequence.definition),
				length,
				pi: asNumber(final.pi, 0),
				reads: asNumber(final.reads, 0),
			},
		});
	}

	// By schema segment, longest first within a rank. The order is what the
	// per-isolate charts are laid out in, and the OTU's segments are drawn in the
	// same one. It no longer decides how the OTU's curves are merged — that is
	// matched by segment rather than by position.
	return measured.sort((a, b) => compareBySegment(a, b, schemaNames));
}

// The schema segments an isolate declares a sequence for, hit or not. It is what
// makes an isolate's silence on a segment readable: one that never declared the
// segment does not carry it, where one that declared it was assigned no reads.
function readDeclaredSegments(sequences: unknown[]): Set<string> {
	const declared = new Set<string>();

	for (const entry of sequences) {
		const segment = asRecord(entry)?.segment;

		if (typeof segment === "string" && segment !== "") {
			declared.add(segment);
		}
	}

	return declared;
}

function formatIsolates(
	isolates: unknown[],
	hitsBySequenceId: Map<string, Record<string, unknown>>,
	schemaNames: string[],
): MeasuredIsolate[] {
	const measured: MeasuredIsolate[] = [];

	for (const entry of isolates) {
		const isolate = asRecord(entry);

		if (!isolate) {
			continue;
		}

		const sequences = formatSequences(
			asArray(isolate.sequences),
			hitsBySequenceId,
			schemaNames,
		);

		// Python gates this on any formatted sequence carrying a `pi` or `final`
		// key. Every sequence it yields always carries `pi`, so the test reduces to
		// "the isolate matched at least one hit" — which is what is written here.
		if (sequences.length === 0) {
			continue;
		}

		// The isolate's own figures are measured across its sequences laid end to
		// end, so a multi-segment genome reports one coverage rather than several.
		const depths = sequences.flatMap((entry) => entry.depths);

		measured.push({
			declaredSegments: readDeclaredSegments(asArray(isolate.sequences)),
			depths,
			sequences,
			isolate: {
				coverage: coverageOf(depths),
				depth: medianDepth(depths),
				id: asString(isolate.id),
				length: depths.length,
				name: formatIsolateName(isolate),
				pi: sequences.reduce((sum, entry) => sum + entry.sequence.pi, 0),
			},
		});
	}

	return measured;
}

function formatHits(
	otuId: string,
	patchedOtu: OtuDocument,
	hits: unknown[],
): PathoscopeHit {
	const isolates = asArray(patchedOtu.isolates);

	let maxSequenceLength = 0;

	// The longest sequence declared for each named segment, over every sequence in
	// the OTU rather than only the ones that were hit. It is what gives a segment
	// nothing mapped to it a width to be drawn at — those sequences are absent
	// from the formatted result, so nothing downstream could recover it.
	const declaredLengths = new Map<string, number>();

	for (const entry of isolates) {
		for (const sequenceEntry of asArray(asRecord(entry)?.sequences)) {
			const sequence = asRecord(sequenceEntry);
			const length = asText(sequence?.sequence).length;

			if (length > maxSequenceLength) {
				maxSequenceLength = length;
			}

			const segment = sequence?.segment;

			if (typeof segment === "string" && segment !== "") {
				declaredLengths.set(
					segment,
					Math.max(declaredLengths.get(segment) ?? 0, length),
				);
			}
		}
	}

	const schemaNames = readSchemaNames(patchedOtu);

	const measured = formatIsolates(
		isolates,
		indexHitsBySequence(hits),
		schemaNames,
	);

	const groups = groupSequencesIntoSegments(
		measured.map((entry) => entry.sequences),
		schemaNames,
		declaredLengths,
	);

	// Each isolate's sequences, rebuilt in the order the segments are drawn in and
	// stamped with the segment each one fills. Every measured sequence lands in
	// exactly one group, so nothing is dropped by going around this way.
	const sequencesByIsolate: PathoscopeSequence[][] = measured.map(() => []);

	for (const group of groups) {
		for (const entry of group.isolates) {
			for (const measuredSequence of entry.sequences) {
				sequencesByIsolate[entry.index]?.push({
					...measuredSequence.sequence,
					segmentKey: group.key,
				});
			}
		}
	}

	// Only a named segment can be reported missing from an isolate. A
	// length-inferred one is a bin over the sequences that were hit, so an unhit
	// sequence has no bin to fall in and nothing here could place it.
	const namedGroups = groups.flatMap((group) =>
		group.name === null ? [] : [{ key: group.key, name: group.name }],
	);

	const merged = groups.map((group) => {
		const depths = mergeDepths(segmentDepths(group));

		return {
			depths,
			// A segment nothing mapped to has no merged curve, so its width comes
			// from the longest sequence the OTU declares for it.
			detected: group.isolates.length > 0,
			key: group.key,
			length: depths.length > 0 ? depths.length : group.declaredLength,
			name: group.name,
		};
	});

	// The OTU's depth figures are read across every segment taken together, so
	// they stay figures about the whole genome now that it is drawn in pieces.
	// Each segment counts once, at the longest length any isolate gave it — where
	// the single concatenated curve this replaced counted the longest isolate and
	// measured the rest against its positions.
	//
	// A segment nothing mapped to contributes no positions rather than a
	// zero-filled genome, so it cannot drag the median down. That is deliberate:
	// counting it would move the OTU's depth on how completely the *reference*
	// describes the genome rather than on what the analysis found, and two
	// references differing only in how many segments they declare would report
	// different depths for the same reads.
	const combined = merged.flatMap((segment) => segment.depths);

	return {
		id: otuId,
		abbreviation: asText(patchedOtu.abbreviation),
		coverage: measured.reduce(
			(greatest, entry) => Math.max(greatest, entry.isolate.coverage),
			0,
		),
		depth: medianDepth(combined),
		// Highest coverage first, which is the order the detail view reads down.
		isolates: measured
			.map((entry, index) => ({
				...entry.isolate,
				absentSegmentKeys: namedGroups
					.filter((group) => !entry.declaredSegments.has(group.name))
					.map((group) => group.key),
				sequences: sequencesByIsolate[index] ?? [],
			}))
			.sort((a, b) => b.coverage - a.coverage),
		length: maxSequenceLength,
		maxDepth: maxDepthOf(combined),
		name: asText(patchedOtu.name),
		pi: measured.reduce((sum, entry) => sum + entry.isolate.pi, 0),
		segments: merged.map((segment) => ({
			align: transformCoverageToCoordinates(segment.depths),
			detected: segment.detected,
			key: segment.key,
			length: segment.length,
			name: segment.name,
		})),
		version: asNumber(patchedOtu.version, 0),
	};
}

async function formatPathoscope(
	db: DbOrTx,
	results: RawResults,
): Promise<PathoscopeResults> {
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

	// The raw blob's keys are the worker's contract, but this envelope is ours, so
	// the two totals are emitted in the casing the rest of the API uses rather
	// than being renamed by every reader.
	return {
		hits: formattedHits,
		readCount: asNumber(results.read_count, 0),
		subtractedCount: asNumber(results.subtracted_count, 0),
	};
}

/** The ORFs of a NuVs contig, read structurally out of the raw blob. */
function asOrfs(value: unknown): NuvsOrf[] {
	return asArray(value).filter((orf): orf is NuvsOrf => asRecord(orf) !== null);
}

function orfHits(orfs: NuvsOrf[]): NuvsOrfHit[] {
	return orfs.flatMap((orf) => asArray(orf.hits) as NuvsOrfHit[]);
}

/**
 * The lowest e-value across a contig's ORF hits.
 *
 * An ORF that matched no annotation contributes zero, which is Python's
 * behaviour and the client's before it. A contig with no ORFs at all has no
 * e-value, and the NuVs list offers a filter that hides exactly those.
 */
function minimumE(orfs: NuvsOrf[]): number | null {
	if (orfs.length === 0) {
		return null;
	}

	return orfs.reduce((lowest, orf) => {
		const hits = asArray(orf.hits) as NuvsOrfHit[];

		const e = hits.reduce(
			(best, hit) => Math.min(best, asNumber(hit.full_e, 0)),
			hits.length > 0 ? Number.POSITIVE_INFINITY : 0,
		);

		return Math.min(lowest, e);
	}, Number.POSITIVE_INFINITY);
}

// The annotations merged onto the ORF hits, gathered back up so the contig can
// be searched and grouped by them. `None` is the HMM data's way of saying a
// cluster has no family, not a family in its own right.
function familiesOf(orfs: NuvsOrf[]): string[] {
	const families = new Set<string>();

	for (const hit of orfHits(orfs)) {
		for (const family of Object.keys(asRecord(hit.families) ?? {})) {
			if (family !== "None") {
				families.add(family);
			}
		}
	}

	return [...families];
}

function namesOf(orfs: NuvsOrf[]): string[] {
	const names = new Set<string>();

	for (const hit of orfHits(orfs)) {
		for (const name of asArray(hit.names)) {
			names.add(asString(name));
		}
	}

	return [...names];
}

// The contig, with the metrics derived from the ORFs the annotations were just
// merged onto. The record is spread rather than rebuilt field by field: what it
// carries beyond `index`, `sequence` and `orfs` is the workflow's to decide.
function measureNuvsHit(record: Record<string, unknown>): NuvsHit {
	const orfs = asOrfs(record.orfs);

	return {
		...record,
		annotatedOrfCount: orfs.filter((orf) => asArray(orf.hits).length > 0)
			.length,
		blast: null,
		e: minimumE(orfs),
		families: familiesOf(orfs),
		id: asNumber(record.index, 0),
		index: asNumber(record.index, 0),
		names: namesOf(orfs),
		orfs,
		sequence: asText(record.sequence),
	};
}

async function annotateNuvsOrfs(
	db: DbOrTx,
	sequences: unknown[],
): Promise<unknown[]> {
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
		return sequences;
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

	return sequences.map((sequence) => {
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
	});
}

async function formatNuvs(
	db: DbOrTx,
	results: RawResults,
): Promise<NuvsResults> {
	const annotated = await annotateNuvsOrfs(db, asArray(results.hits));

	const hits = annotated
		.map(asRecord)
		.filter((record) => record !== null)
		.map(measureNuvsHit);

	return {
		hits,
		maxSequenceLength: hits.reduce(
			(longest, hit) => Math.max(longest, hit.sequence.length),
			0,
		),
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
