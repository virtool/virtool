// The OTU domain: OTUs, their isolates, and their sequences.
//
// A port of `virtool.otus.data`, `virtool.otus.db`, and `virtool.otus.utils`.
// Python still writes these tables — reference import, clone, remote update and
// index build all do — so every write here produces the same document shape it
// would, `data` JSONB included.
//
// Two shapes appear throughout, and conflating them corrupts history:
//
//   - The *stored* document is verbatim Mongo: `_id`, snake_case, isolates
//     embedded in `legacy_otus.data`. Diffs address it exactly as written, so it
//     is what `joinLegacyOtus` returns and what a history diff is composed from.
//   - The *wire* shape is what a server function returns: `id`, camelCase, and
//     the nested reference resolved. It is produced only at the boundary, by the
//     `format*` helpers at the bottom of this file.

import {
	formatIsolateName,
	type HistoryNested,
	type IsolateCreateRequest,
	type IsolateUpdateRequest,
	type Otu,
	type OtuCreateRequest,
	type OtuEmptySequence,
	type OtuIsolate,
	type OtuIssueReport,
	type OtuMinimal,
	type OtuSearchResult,
	type OtuSegment,
	type OtuSequence,
	type OtuUpdateRequest,
	type SequenceCreateRequest,
	type SequenceUpdateRequest,
} from "@virtool/contracts";
import {
	and,
	count,
	countDistinct,
	eq,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { legacyHistory } from "../db/schema/history";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { legacyReferences } from "../db/schema/references";
import { AppError } from "../errors";
import {
	addHistory,
	composeCreateDescription,
	composeEditDescription,
	composeRemoveDescription,
} from "../history/add";
import { getMostRecentChange } from "../history/data";
import {
	ReferenceArchivedError,
	ReferenceNotFoundError,
} from "../references/data";

/** A joined OTU document, recovered verbatim from the `data` JSONB column. */
export type OtuDocument = Record<string, unknown>;

/** A sequence document, recovered verbatim from the `data` JSONB column. */
type SequenceDocument = Record<string, unknown>;

/** Thrown when no OTU holds the requested id. */
export class OtuNotFoundError extends AppError {}

/** Thrown when an OTU carries no isolate with the requested id. */
export class IsolateNotFoundError extends AppError {}

/** Thrown when no sequence holds the requested id. */
export class SequenceNotFoundError extends AppError {}

/** Thrown when an OTU's name or abbreviation is already used in its reference. */
export class OtuNameConflictError extends AppError {}

/** Thrown when a reference restricts source types and does not permit this one. */
export class SourceTypeNotAllowedError extends AppError {}

/** Thrown when a sequence names a segment its parent OTU's schema does not define. */
export class SegmentNotDefinedError extends AppError {}

/**
 * Thrown when an OTU row's `data` carries no `isolates` array. Every OTU
 * document has one, so this is a data-integrity violation rather than a routine
 * outcome — merging around it would hand back an OTU whose sequences silently
 * vanished.
 */
class MalformedOtuDataError extends AppError {}

// Ids are the 8-character mixed-case alphanumeric strings Mongo's `_id` held,
// because the columns that key on them are still `VARCHAR` and Python still
// generates them this way.
const ID_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const ID_LENGTH = 8;

function randomId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));

	return Array.from(
		bytes,
		(byte) => ID_ALPHABET[byte % ID_ALPHABET.length],
	).join("");
}

// Keep drawing until Postgres has no row under the id. The create paths need the
// id before the row is written, so it cannot come from the insert. A concurrent
// create landing on the same id in the same instant still races, which the
// insert-only write turns into a constraint violation rather than a clobbered
// row — the same outcome Mongo's unique `_id` index produced.
async function generateId(
	tx: DbOrTx,
	taken: (tx: DbOrTx, id: string) => Promise<boolean>,
): Promise<string> {
	for (;;) {
		const id = randomId();

		if (!(await taken(tx, id))) {
			return id;
		}
	}
}

async function otuIdTaken(tx: DbOrTx, id: string): Promise<boolean> {
	const [row] = await tx
		.select({ id: legacyOtus.id })
		.from(legacyOtus)
		.where(eq(legacyOtus.id, id))
		.limit(1);

	return row !== undefined;
}

async function sequenceIdTaken(tx: DbOrTx, id: string): Promise<boolean> {
	const [row] = await tx
		.select({ id: legacySequences.id })
		.from(legacySequences)
		.where(eq(legacySequences.id, id))
		.limit(1);

	return row !== undefined;
}

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

// The inverse of `mergeOtu`: lift the sequences back out so the OTU document can
// be written to `data`, which never holds them.
function splitOtu(merged: OtuDocument): OtuDocument {
	const isolates = merged.isolates;

	if (!Array.isArray(isolates)) {
		throw new MalformedOtuDataError(
			`OTU ${String(merged._id)} has no isolates array`,
		);
	}

	return {
		...merged,
		isolates: isolates.map((isolate) => {
			const { sequences: _sequences, ...rest } = isolate as Record<
				string,
				unknown
			>;

			return rest;
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
 * Read through the caller's transaction when one is passed, so an OTU written
 * earlier in it joins as it now stands. The write path depends on that: it
 * composes a history diff from the OTU before and after its own uncommitted
 * writes.
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

// A single OTU, joined. Returns undefined for an OTU with no row.
async function joinLegacyOtu(
	tx: DbOrTx,
	otuId: string,
): Promise<OtuDocument | undefined> {
	return (await joinLegacyOtus(tx, [otuId])).get(otuId);
}

/** The parent reference of an OTU, with the policy an isolate write consults. */
type ReferenceContext = {
	id: number;
	name: string;
	restrictSourceTypes: boolean;
	sourceTypes: string[];
};

/** An OTU joined together with its parent reference. */
type OtuWithReference = {
	document: OtuDocument;
	reference: ReferenceContext;
};

// A sequence's document, in the `position` order a joined OTU must present.
async function readSequenceDocuments(
	tx: DbOrTx,
	otuId: string,
): Promise<SequenceDocument[]> {
	const rows = await tx
		.select({ data: legacySequences.data })
		.from(legacySequences)
		.where(eq(legacySequences.otu_id, otuId))
		.orderBy(legacySequences.position);

	return rows.map((row) => row.data);
}

/**
 * Read an OTU and its parent reference together, optionally under a row lock.
 *
 * Two queries — the OTU with its reference, then its sequences — where the
 * write path previously issued four against the same row: a lock, a reference
 * lookup, the OTU half of the join, and for a sequence write a separate read of
 * the schema. They all resolve the same `legacy_otus` row, so they collapse into
 * one statement, and the schema and source-type policy the checks need come back
 * with it rather than costing a query each.
 *
 * `lock` takes `FOR UPDATE OF legacy_otus`, which serializes concurrent edits so
 * no version bump is lost. The lock names the OTU explicitly: an unqualified
 * `FOR UPDATE` would also lock the joined reference row, which this is not
 * editing and which every OTU in that reference would then contend on.
 *
 * Locking and reading in one statement is also stricter than the two-step it
 * replaces — there is no longer a window between taking the lock and reading
 * what the edit is composed from.
 */
async function readOtuWithReference(
	tx: DbOrTx,
	otuId: string,
	lock: boolean,
): Promise<OtuWithReference> {
	const query = tx
		.select({
			data: legacyOtus.data,
			referenceId: legacyReferences.id,
			referenceName: legacyReferences.name,
			restrictSourceTypes: legacyReferences.restrict_source_types,
			sourceTypes: legacyReferences.source_types,
		})
		.from(legacyOtus)
		.innerJoin(
			legacyReferences,
			eq(legacyOtus.reference_id, legacyReferences.id),
		)
		.where(eq(legacyOtus.id, otuId))
		.limit(1);

	const [row] = lock
		? await query.for("update", { of: legacyOtus })
		: await query;

	if (row === undefined) {
		throw new OtuNotFoundError(`OTU ${otuId} not found`);
	}

	return {
		document: mergeOtu(row.data, await readSequenceDocuments(tx, otuId)),
		reference: {
			id: row.referenceId,
			name: row.referenceName,
			restrictSourceTypes: row.restrictSourceTypes,
			sourceTypes: row.sourceTypes,
		},
	};
}

function isolatesOf(document: OtuDocument): Record<string, unknown>[] {
	const isolates = document.isolates;

	if (!Array.isArray(isolates)) {
		throw new MalformedOtuDataError(
			`OTU ${String(document._id)} has no isolates array`,
		);
	}

	return isolates as Record<string, unknown>[];
}

function findIsolate(
	document: OtuDocument,
	isolateId: string,
): Record<string, unknown> {
	const isolate = isolatesOf(document).find(
		(candidate) => candidate.id === isolateId,
	);

	if (isolate === undefined) {
		throw new IsolateNotFoundError(
			`Isolate ${isolateId} not found on OTU ${String(document._id)}`,
		);
	}

	return isolate;
}

// Every promoted column is recomputed from the document, so the same values
// serve an insert and an update and the row stays in sync on each write.
function otuRowValues(document: OtuDocument, referenceId: number) {
	const abbreviation = document.abbreviation;

	return {
		id: String(document._id),
		data: document,
		name: String(document.name),
		abbreviation: typeof abbreviation === "string" ? abbreviation : "",
		last_indexed_version:
			typeof document.last_indexed_version === "number"
				? document.last_indexed_version
				: null,
		reference_id: referenceId,
		verified: document.verified === true,
		version: Number(document.version),
	};
}

async function insertLegacyOtu(
	tx: DbOrTx,
	document: OtuDocument,
	referenceId: number,
): Promise<void> {
	await tx.insert(legacyOtus).values(otuRowValues(document, referenceId));
}

async function writeLegacyOtu(
	tx: DbOrTx,
	document: OtuDocument,
	referenceId: number,
): Promise<void> {
	const values = otuRowValues(document, referenceId);
	const { id: _id, ...updatable } = values;

	await tx
		.insert(legacyOtus)
		.values(values)
		.onConflictDoUpdate({ target: legacyOtus.id, set: updatable });
}

// Bump the version and clear `verified` in one statement, writing the promoted
// columns and their copies inside `data` together. Postgres evaluates every SET
// expression against the old row, so both references to `version` see the
// pre-bump value.
async function incrementLegacyOtuVersion(
	tx: DbOrTx,
	otuId: string,
): Promise<void> {
	await tx
		.update(legacyOtus)
		.set({
			version: sql`${legacyOtus.version} + 1`,
			verified: false,
			data: sql`${legacyOtus.data} || jsonb_build_object('version', ${legacyOtus.version} + 1, 'verified', false)`,
		})
		.where(eq(legacyOtus.id, otuId));
}

/**
 * Re-verify an OTU after a mutation, returning the joined document as it now
 * stands. The version bump already cleared `verified`, so this only has to set
 * it back when the OTU passes.
 *
 * The returned document is what the caller must record the change against. A
 * document that still said `verified: false` while the row said `true` would
 * put that disagreement into the diff — the change that verified an OTU would
 * record no transition at all, and the next change would record a spurious
 * `true → false`. Replaying those diffs hands back an OTU verified when it was
 * not, which a reference clone then writes into a new row. Python mutates its
 * caller's copy for the same reason; a joined document here is shared structure
 * and read-only, so this rebuilds instead.
 */
async function updateLegacyOtuVerification(
	tx: DbOrTx,
	joined: OtuDocument,
): Promise<OtuDocument> {
	if (verify(joined) !== null) {
		return joined;
	}

	await tx
		.update(legacyOtus)
		.set({
			verified: true,
			data: sql`${legacyOtus.data} || jsonb_build_object('verified', true)`,
		})
		.where(eq(legacyOtus.id, String(joined._id)));

	return { ...joined, verified: true };
}

// The next free `position` in an OTU, evaluated by Postgres inside the insert so
// the read and the write cannot interleave. Scoped to the OTU, not the isolate;
// the first sequence in an OTU takes 0.
function nextSequencePosition(otuId: string) {
	return sql<number>`(select coalesce(max(${legacySequences.position}) + 1, 0) from ${legacySequences} where ${legacySequences.otu_id} = ${otuId})`;
}

function sequenceRowValues(document: SequenceDocument) {
	const segment = document.segment;

	return {
		id: String(document._id),
		data: document,
		otu_id: String(document.otu_id),
		isolate_id: String(document.isolate_id),
		segment: typeof segment === "string" ? segment : null,
	};
}

async function insertLegacySequence(
	tx: DbOrTx,
	document: SequenceDocument,
): Promise<void> {
	await tx.insert(legacySequences).values({
		...sequenceRowValues(document),
		position: nextSequencePosition(String(document.otu_id)),
	});
}

// An existing sequence keeps the `position` it holds: the column is left out of
// the conflict update, so an edit never renumbers it and never reorders the OTU.
async function writeLegacySequence(
	tx: DbOrTx,
	document: SequenceDocument,
): Promise<void> {
	const values = sequenceRowValues(document);
	const { id: _id, ...updatable } = values;

	await tx
		.insert(legacySequences)
		.values({ ...values, position: nextSequencePosition(values.otu_id) })
		.onConflictDoUpdate({ target: legacySequences.id, set: updatable });
}

// Unset `segment` on sequences naming a segment the new schema no longer
// defines.
//
// The segment is *removed* from `data` with the JSONB `-` operator rather than
// set to null, because `data` must stay a faithful lift of the document the OTU
// was written from, where an unset segment is an absent field. The two are not
// interchangeable: a lingering `"segment": null` diffs as a changed field where
// an absent one diffs as a removed field, and every patch built on it would
// disagree. The promoted column has no such distinction to preserve.
async function updateLegacySequenceSegments(
	tx: DbOrTx,
	otuId: string,
	oldSchema: OtuSegment[] | null,
	newSchema: OtuSegment[],
): Promise<void> {
	// An OTU that gained a schema for the first time has no old names to drop.
	if (oldSchema === null) {
		return;
	}

	const kept = new Set(newSchema.map((segment) => segment.name));
	const dropped = oldSchema
		.map((segment) => segment.name)
		.filter((name) => !kept.has(name));

	if (dropped.length === 0) {
		return;
	}

	await tx
		.update(legacySequences)
		.set({
			segment: null,
			data: sql`${legacySequences.data} - 'segment'`,
		})
		.where(
			and(
				eq(legacySequences.otu_id, otuId),
				inArray(legacySequences.segment, dropped),
			),
		);
}

/**
 * Check that an OTU's validation issues are resolved, returning them or `null`
 * when there are none.
 *
 * Every field is present whether or not it fired, and a field that did not fire
 * is `false` rather than an empty list — the shape Python's `verify` returns.
 * `verified` on the row is exactly `verify(...) === null`.
 */
function verify(joined: OtuDocument): OtuIssueReport | null {
	const isolates = isolatesOf(joined);

	const emptyIsolate: string[] = [];
	const emptySequence: OtuEmptySequence[] = [];
	const sequenceCounts: number[] = [];

	for (const isolate of isolates) {
		const sequences = Array.isArray(isolate.sequences)
			? (isolate.sequences as SequenceDocument[])
			: [];

		if (sequences.length === 0) {
			emptyIsolate.push(String(isolate.id));
		}

		sequenceCounts.push(sequences.length);

		for (const sequence of sequences) {
			if (String(sequence.sequence ?? "").length === 0) {
				emptySequence.push({
					id: String(sequence._id),
					isolateId: String(sequence.isolate_id),
				});
			}
		}
	}

	const emptyOtu = isolates.length === 0;

	// An OTU that is empty, or has an empty isolate, is already failing for a
	// reason that explains the mismatched counts, so the inconsistency is
	// suppressed rather than piled on.
	const isolateInconsistency =
		new Set(sequenceCounts).size !== 1 &&
		!(emptyOtu || emptyIsolate.length > 0);

	const issues: OtuIssueReport = {
		emptyIsolate: emptyIsolate.length > 0 ? emptyIsolate : false,
		emptyOtu,
		emptySequence: emptySequence.length > 0 ? emptySequence : false,
		isolateInconsistency,
	};

	const hasIssues =
		issues.emptyOtu ||
		issues.isolateInconsistency ||
		issues.emptyIsolate !== false ||
		issues.emptySequence !== false;

	return hasIssues ? issues : null;
}

function formatSequence(document: SequenceDocument): OtuSequence {
	const host = document.host;
	const segment = document.segment;
	const remote = document.remote as { id?: unknown } | undefined;

	return {
		accession: String(document.accession ?? ""),
		definition: String(document.definition ?? ""),
		host: typeof host === "string" ? host : "",
		id: String(document._id),
		remote:
			remote && typeof remote === "object" && remote.id !== undefined
				? { id: String(remote.id) }
				: null,
		segment: typeof segment === "string" ? segment : null,
		sequence: String(document.sequence ?? ""),
	};
}

function formatIsolate(isolate: Record<string, unknown>): OtuIsolate {
	const sequences = Array.isArray(isolate.sequences)
		? (isolate.sequences as SequenceDocument[])
		: [];

	return {
		default: isolate.default === true,
		id: String(isolate.id),
		sequences: sequences.map(formatSequence),
		sourceName: String(isolate.source_name ?? ""),
		sourceType: String(isolate.source_type ?? ""),
	};
}

function formatSchema(document: OtuDocument): OtuSegment[] {
	const schema = document.schema;

	return Array.isArray(schema) ? (schema as OtuSegment[]) : [];
}

/**
 * Whether two schemas describe the same segments in the same order.
 *
 * Compared field by field rather than by serialising both sides. Postgres
 * normalises a jsonb object's keys by length and then bytes, so a schema read
 * back from `data` spells a segment `{name, molecule, required}` where the
 * request that wrote it spelled it `{molecule, name, required}`. Two JSON
 * strings would therefore never match, and every request carrying a schema
 * would look like a change — bumping the version, writing a bogus history
 * entry, and pushing the OTU into the unbuilt-changes list that prompts an
 * index rebuild. Python compares dicts, which ignores key order for the same
 * reason.
 *
 * Segment order is still significant: reordering a schema *is* a change.
 */
function isSameSchema(left: OtuSegment[], right: OtuSegment[]): boolean {
	return (
		left.length === right.length &&
		left.every((segment, index) => {
			const other = right[index];

			return (
				other !== undefined &&
				segment.name === other.name &&
				segment.required === other.required &&
				(segment.molecule ?? null) === (other.molecule ?? null)
			);
		})
	);
}

function formatOtu(
	joined: OtuDocument,
	reference: { id: number; name: string },
	mostRecentChange: HistoryNested | null,
): Otu {
	const remote = joined.remote as { id?: unknown } | undefined;
	const lastIndexedVersion = joined.last_indexed_version;

	return {
		abbreviation: String(joined.abbreviation ?? ""),
		id: String(joined._id),
		isolates: isolatesOf(joined).map(formatIsolate),
		issues: verify(joined),
		lastIndexedVersion:
			typeof lastIndexedVersion === "number" ? lastIndexedVersion : null,
		mostRecentChange,
		name: String(joined.name),
		reference,
		remote:
			remote && typeof remote === "object" && remote.id !== undefined
				? { id: String(remote.id) }
				: null,
		schema: formatSchema(joined),
		verified: joined.verified === true,
		version: Number(joined.version),
	};
}

// Escape the ILIKE metacharacters so a term containing `%` or `_` matches
// literally rather than as a wildcard.
function toSearchPattern(term: string): string {
	return `%${term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

/** The filters and page a {@link findOtus} call reads. */
export type FindOtusOptions = {
	page: number;
	perPage: number;
	term: string;
};

/**
 * A page of the OTUs belonging to a reference, ordered by name.
 *
 * `modifiedCount` counts the OTUs with changes not yet in a built index, which
 * is what the toolbar reports as pending a rebuild. It is scoped to the
 * reference and counts distinct OTUs, not changes.
 */
export async function findOtus(
	db: DbOrTx,
	referenceId: number,
	options: FindOtusOptions,
): Promise<OtuSearchResult> {
	const { page, perPage, term } = options;

	const belongsToReference = eq(legacyOtus.reference_id, referenceId);

	const searchFilters = and(
		belongsToReference,
		term
			? or(
					sql`${legacyOtus.name} ilike ${toSearchPattern(term)} escape '\\'`,
					sql`${legacyOtus.abbreviation} ilike ${toSearchPattern(term)} escape '\\'`,
				)
			: undefined,
	);

	const matchesSearch = term
		? or(
				sql`${legacyOtus.name} ilike ${toSearchPattern(term)} escape '\\'`,
				sql`${legacyOtus.abbreviation} ilike ${toSearchPattern(term)} escape '\\'`,
			)
		: sql`true`;

	const [[counts], rows, [modified]] = await Promise.all([
		// Anchored on the reference and left-joined to its OTUs, so one statement
		// answers three questions: whether the reference exists at all (a row comes
		// back either way, where counting OTUs alone cannot tell a missing
		// reference from an empty one), how many OTUs it holds, and how many match
		// the search. The two counts share the scan rather than repeating it.
		db
			.select({
				total: count(legacyOtus.id),
				found: sql<number>`count(${legacyOtus.id}) filter (where ${matchesSearch})`,
			})
			.from(legacyReferences)
			.leftJoin(legacyOtus, eq(legacyOtus.reference_id, legacyReferences.id))
			.where(eq(legacyReferences.id, referenceId))
			.groupBy(legacyReferences.id),
		db
			.select({
				id: legacyOtus.id,
				abbreviation: legacyOtus.abbreviation,
				name: legacyOtus.name,
				verified: legacyOtus.verified,
				version: legacyOtus.version,
				referenceId: legacyReferences.id,
				referenceName: legacyReferences.name,
			})
			.from(legacyOtus)
			.innerJoin(
				legacyReferences,
				eq(legacyOtus.reference_id, legacyReferences.id),
			)
			.where(searchFilters)
			// `lower(name), id` matches the `legacy_otus_name_lower` index, and is
			// deliberately not the byte-order sort the Mongo query used.
			.orderBy(sql`lower(${legacyOtus.name})`, legacyOtus.id)
			.limit(perPage)
			.offset(perPage * (page - 1)),
		db
			.select({ value: countDistinct(legacyHistory.otu) })
			.from(legacyHistory)
			.where(
				and(
					eq(legacyHistory.reference_id, referenceId),
					isNull(legacyHistory.index_id),
				),
			),
	]);

	// No row at all means no such reference. A reference with no OTUs still
	// returns one, with both counts at zero.
	if (counts === undefined) {
		throw new ReferenceNotFoundError("Reference does not exist");
	}

	const foundCount = Number(counts.found);

	const items: OtuMinimal[] = rows.map((row) => ({
		abbreviation: row.abbreviation,
		id: row.id,
		name: row.name,
		reference: { id: row.referenceId, name: row.referenceName },
		verified: row.verified,
		version: row.version,
	}));

	return {
		items,
		foundCount,
		modifiedCount: modified?.value ?? 0,
		page,
		pageCount: Math.ceil(foundCount / perPage),
		perPage,
		totalCount: Number(counts.total),
	};
}

/** The reference an OTU belongs to, as an authorization check needs to see it. */
export type OtuReference = { id: number; archived: boolean };

/**
 * The reference an OTU belongs to, or `null` when the OTU — or, when one is
 * named, the isolate — does not exist.
 *
 * Scoping by isolate in the same query is what makes a bad isolate id a 404
 * rather than a 403: the authorization check cannot pass for an isolate the OTU
 * does not carry.
 *
 * `archived` rides along on the join because every OTU, isolate, and sequence
 * mutation has to refuse an archived parent, and reading it here costs no extra
 * round trip.
 */
export async function getOtuReference(
	db: DbOrTx,
	otuId: string,
	isolateId?: string,
): Promise<OtuReference | null> {
	const [row] = await db
		.select({
			id: legacyOtus.reference_id,
			archived: legacyReferences.archived,
		})
		.from(legacyOtus)
		.innerJoin(
			legacyReferences,
			eq(legacyReferences.id, legacyOtus.reference_id),
		)
		.where(
			and(
				eq(legacyOtus.id, otuId),
				isolateId === undefined
					? undefined
					: sql`${legacyOtus.data} -> 'isolates' @> ${JSON.stringify([{ id: isolateId }])}::jsonb`,
			),
		)
		.limit(1);

	return row ?? null;
}

/**
 * Whether the isolate carries a sequence with this id.
 *
 * Scoped rather than a bare id lookup so that a sequence in another reference
 * cannot be confirmed to exist by a caller who holds no rights over it — the
 * rights check that follows is against the OTU, not the sequence.
 */
export async function sequenceExists(
	db: DbOrTx,
	otuId: string,
	isolateId: string,
	sequenceId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: legacySequences.id })
		.from(legacySequences)
		.where(
			and(
				eq(legacySequences.id, sequenceId),
				eq(legacySequences.otu_id, otuId),
				eq(legacySequences.isolate_id, isolateId),
			),
		)
		.limit(1);

	return row !== undefined;
}

/** A single OTU, with its isolates, their sequences, and its latest change. */
export async function getOtu(db: DbOrTx, otuId: string): Promise<Otu> {
	const [{ document, reference }, mostRecentChange] = await Promise.all([
		readOtuWithReference(db, otuId, false),
		getMostRecentChange(db, otuId),
	]);

	return formatOtu(document, reference, mostRecentChange);
}

// Read an OTU inside a write transaction and format it for the response, after
// the mutation has committed its rows to the transaction.
async function getOtuInTransaction(tx: DbOrTx, otuId: string): Promise<Otu> {
	// Sequential rather than concurrent: a transaction is one connection, and
	// issuing overlapping statements on it relies on driver pipelining rather
	// than on anything this code controls.
	const { document, reference } = await readOtuWithReference(tx, otuId, false);

	return formatOtu(document, reference, await getMostRecentChange(tx, otuId));
}

// The name is matched on `lower(name)` rather than the denormalised `lower_name`
// field the Mongo query used; the `legacy_otus_name_lower` index makes that
// expression a lookup rather than a scan. The abbreviation is matched exactly,
// case included, as Python does. An empty value is never "in use".
async function checkNameAndAbbreviation(
	tx: DbOrTx,
	referenceId: number,
	name: string | null,
	abbreviation: string | null,
): Promise<void> {
	const scope = eq(legacyOtus.reference_id, referenceId);

	const [nameRows, abbreviationRows] = await Promise.all([
		name
			? tx
					.select({ id: legacyOtus.id })
					.from(legacyOtus)
					.where(
						and(scope, sql`lower(${legacyOtus.name}) = ${name.toLowerCase()}`),
					)
					.limit(1)
			: Promise.resolve([]),
		abbreviation
			? tx
					.select({ id: legacyOtus.id })
					.from(legacyOtus)
					.where(and(scope, eq(legacyOtus.abbreviation, abbreviation)))
					.limit(1)
			: Promise.resolve([]),
	]);

	const nameExists = nameRows.length > 0;
	const abbreviationExists = abbreviationRows.length > 0;

	if (nameExists && abbreviationExists) {
		throw new OtuNameConflictError("Name and abbreviation already exist");
	}

	if (nameExists) {
		throw new OtuNameConflictError("Name already exists");
	}

	if (abbreviationExists) {
		throw new OtuNameConflictError("Abbreviation already exists");
	}
}

// A segment is only checked when one is named; clearing it is always allowed.
// The schema comes off the OTU the caller has already read under its lock.
function checkSequenceSegment(
	document: OtuDocument,
	segment: string | null | undefined,
): void {
	if (!segment) {
		return;
	}

	if (!formatSchema(document).some((declared) => declared.name === segment)) {
		throw new SegmentNotDefinedError(
			`Segment ${segment} is not defined for the parent OTU`,
		);
	}
}

// A reference that restricts its source types permits only those it lists. The
// `unknown` type and the empty string are always allowed. The policy arrives
// with the OTU's locked read rather than costing a query of its own.
function checkSourceType(
	reference: ReferenceContext,
	sourceType: string,
): void {
	if (sourceType === "unknown" || sourceType === "") {
		return;
	}

	if (!reference.restrictSourceTypes) {
		return;
	}

	if (!reference.sourceTypes.includes(sourceType)) {
		throw new SourceTypeNotAllowedError("Source type is not allowed");
	}
}

/** Create an OTU in a reference, recording the change that created it. */
export async function createOtu(
	db: Db,
	referenceId: number,
	values: OtuCreateRequest,
	userId: number,
): Promise<Otu> {
	return db.transaction(async (tx) => {
		const [reference] = await tx
			.select({ archived: legacyReferences.archived })
			.from(legacyReferences)
			.where(eq(legacyReferences.id, referenceId))
			.limit(1);

		if (reference === undefined) {
			throw new ReferenceNotFoundError("Reference does not exist");
		}

		if (reference.archived) {
			throw new ReferenceArchivedError("Reference is archived");
		}

		await checkNameAndAbbreviation(
			tx,
			referenceId,
			values.name,
			values.abbreviation,
		);

		const document: OtuDocument = {
			_id: await generateId(tx, otuIdTaken),
			name: values.name,
			abbreviation: values.abbreviation,
			last_indexed_version: null,
			verified: false,
			lower_name: values.name.toLowerCase(),
			isolates: [],
			version: 0,
			reference: { id: referenceId },
			schema: values.schema,
		};

		await insertLegacyOtu(tx, document, referenceId);

		await addHistory(tx, {
			description: composeCreateDescription(document),
			methodName: "create",
			old: null,
			new: document,
			referenceId,
			userId,
		});

		return getOtuInTransaction(tx, String(document._id));
	});
}

/**
 * Update an OTU's name, abbreviation, or schema.
 *
 * An update that changes nothing writes nothing — no version bump, no history
 * row — and returns the OTU as it stands.
 */
export async function updateOtu(
	db: Db,
	otuId: string,
	values: OtuUpdateRequest,
	userId: number,
): Promise<Otu> {
	return db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const oldDocument = splitOtu(old);
		const oldAbbreviation = String(oldDocument.abbreviation ?? "");
		const oldSchema = Array.isArray(oldDocument.schema)
			? (oldDocument.schema as OtuSegment[])
			: null;

		// Only a field that was both supplied and differs counts as a change. An
		// update where nothing does writes nothing at all.
		const changedName =
			values.name !== undefined && values.name !== oldDocument.name
				? values.name
				: null;

		const changedAbbreviation =
			values.abbreviation !== undefined &&
			values.abbreviation !== oldAbbreviation
				? values.abbreviation
				: null;

		const schemaChanged =
			values.schema !== undefined &&
			!isSameSchema(values.schema, oldSchema ?? []);

		if (
			changedName === null &&
			changedAbbreviation === null &&
			!schemaChanged
		) {
			return getOtuInTransaction(tx, otuId);
		}

		const referenceId = reference.id;

		// Only the changed values are checked, so an OTU keeping its own name never
		// collides with itself.
		await checkNameAndAbbreviation(
			tx,
			referenceId,
			changedName,
			changedAbbreviation,
		);

		const newDocument: OtuDocument = {
			...oldDocument,
			...(values.name !== undefined && {
				name: values.name,
				lower_name: values.name.toLowerCase(),
			}),
			...(values.abbreviation !== undefined && {
				abbreviation: values.abbreviation,
			}),
			...(values.schema !== undefined && { schema: values.schema }),
			verified: false,
			version: Number(oldDocument.version) + 1,
		};

		await writeLegacyOtu(tx, newDocument, referenceId);

		await updateLegacySequenceSegments(
			tx,
			otuId,
			oldSchema,
			formatSchema(newDocument),
		);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: composeEditDescription(
				changedName,
				changedAbbreviation,
				oldAbbreviation,
				schemaChanged,
			),
			methodName: "edit",
			old,
			new: verified,
			referenceId,
			userId,
		});

		return getOtuInTransaction(tx, otuId);
	});
}

/** Remove an OTU. Its sequences cascade; the change records the whole document. */
export async function deleteOtu(
	db: Db,
	otuId: string,
	userId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		const { document: joined, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const referenceId = reference.id;

		await tx.delete(legacyOtus).where(eq(legacyOtus.id, otuId));

		await addHistory(tx, {
			description: composeRemoveDescription(joined),
			methodName: "remove",
			old: joined,
			new: null,
			referenceId,
			userId,
		});
	});
}

/**
 * Create an isolate on an OTU.
 *
 * The first isolate an OTU gets is its default whether or not one was asked for
 * — an OTU with isolates always has exactly one default.
 */
export async function createIsolate(
	db: Db,
	otuId: string,
	values: IsolateCreateRequest,
	userId: number,
): Promise<OtuIsolate> {
	const sourceType = values.sourceType.toLowerCase();

	return db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const referenceId = reference.id;

		checkSourceType(reference, sourceType);

		const oldDocument = splitOtu(old);
		const existing = isolatesOf(oldDocument);

		const willBeDefault = existing.length === 0 || values.default;

		const taken = new Set(existing.map((isolate) => String(isolate.id)));

		let isolateId = randomId();

		while (taken.has(isolateId)) {
			isolateId = randomId();
		}

		const isolate = {
			id: isolateId,
			default: willBeDefault,
			source_type: sourceType,
			source_name: values.sourceName,
		};

		const newDocument: OtuDocument = {
			...oldDocument,
			isolates: [
				...existing.map((candidate) =>
					willBeDefault ? { ...candidate, default: false } : candidate,
				),
				isolate,
			],
			verified: false,
			version: Number(oldDocument.version) + 1,
		};

		await writeLegacyOtu(tx, newDocument, referenceId);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Added ${formatIsolateName(isolate)}${willBeDefault ? " as default" : ""}`,
			methodName: "add_isolate",
			old,
			new: verified,
			referenceId,
			userId,
		});

		return formatIsolate({ ...isolate, sequences: [] });
	});
}

/** Rename an isolate. */
export async function updateIsolate(
	db: Db,
	otuId: string,
	isolateId: string,
	values: IsolateUpdateRequest,
	userId: number,
): Promise<OtuIsolate> {
	const sourceType = values.sourceType?.toLowerCase();

	return db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const referenceId = reference.id;

		if (sourceType !== undefined) {
			checkSourceType(reference, sourceType);
		}

		const oldDocument = splitOtu(old);
		const target = findIsolate(oldDocument, isolateId);
		const oldName = formatIsolateName(target);

		const updatedIsolate = {
			...target,
			...(sourceType !== undefined && { source_type: sourceType }),
			...(values.sourceName !== undefined && {
				source_name: values.sourceName,
			}),
		};

		const newDocument: OtuDocument = {
			...oldDocument,
			isolates: isolatesOf(oldDocument).map((candidate) =>
				candidate.id === isolateId ? updatedIsolate : candidate,
			),
			verified: false,
			version: Number(oldDocument.version) + 1,
		};

		await writeLegacyOtu(tx, newDocument, referenceId);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Renamed ${oldName} to ${formatIsolateName(updatedIsolate)}`,
			methodName: "edit_isolate",
			old,
			new: verified,
			referenceId,
			userId,
		});

		return formatIsolate(findIsolate(updated, isolateId));
	});
}

/**
 * Make an isolate the OTU's default.
 *
 * An isolate that is already the default is returned untouched: no version bump
 * and no history row, because nothing changed.
 */
export async function setIsolateAsDefault(
	db: Db,
	otuId: string,
	isolateId: string,
	userId: number,
): Promise<OtuIsolate> {
	return db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const oldDocument = splitOtu(old);
		const target = findIsolate(oldDocument, isolateId);

		if (target.default === true) {
			return formatIsolate(findIsolate(old, isolateId));
		}

		const referenceId = reference.id;

		const newDocument: OtuDocument = {
			...oldDocument,
			isolates: isolatesOf(oldDocument).map((candidate) => ({
				...candidate,
				default: candidate.id === isolateId,
			})),
			verified: false,
			version: Number(oldDocument.version) + 1,
		};

		await writeLegacyOtu(tx, newDocument, referenceId);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Set ${formatIsolateName(target)} as default`,
			methodName: "set_as_default",
			old,
			new: verified,
			referenceId,
			userId,
		});

		return formatIsolate(findIsolate(updated, isolateId));
	});
}

/**
 * Delete an isolate and its sequences.
 *
 * Deleting the default isolate promotes the first of those left, so an OTU with
 * isolates never ends up without a default.
 */
export async function deleteIsolate(
	db: Db,
	otuId: string,
	isolateId: string,
	userId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const oldDocument = splitOtu(old);
		const target = findIsolate(oldDocument, isolateId);
		const referenceId = reference.id;

		const remaining = isolatesOf(oldDocument).filter(
			(candidate) => candidate.id !== isolateId,
		);

		const promoted = target.default === true ? (remaining[0] ?? null) : null;

		const newDocument: OtuDocument = {
			...oldDocument,
			isolates: remaining.map((candidate) =>
				candidate === promoted ? { ...candidate, default: true } : candidate,
			),
			verified: false,
			version: Number(oldDocument.version) + 1,
		};

		await writeLegacyOtu(tx, newDocument, referenceId);

		await tx
			.delete(legacySequences)
			.where(
				and(
					eq(legacySequences.otu_id, otuId),
					eq(legacySequences.isolate_id, isolateId),
				),
			);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Removed ${formatIsolateName(target)}${
				promoted === null
					? ""
					: ` and set ${formatIsolateName(promoted)} as default`
			}`,
			methodName: "remove_isolate",
			old,
			new: verified,
			referenceId,
			userId,
		});
	});
}

/** Add a sequence to an isolate. */
export async function createSequence(
	db: Db,
	otuId: string,
	isolateId: string,
	values: SequenceCreateRequest,
	userId: number,
): Promise<OtuSequence> {
	return db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const referenceId = reference.id;

		checkSequenceSegment(old, values.segment);

		const isolate = findIsolate(old, isolateId);

		// The stored key order is the order Python writes it in, so `data` stays a
		// faithful lift of the document a diff was composed against.
		const document: SequenceDocument = {
			_id: await generateId(tx, sequenceIdTaken),
			accession: values.accession,
			definition: values.definition,
			otu_id: otuId,
			isolate_id: isolateId,
			host: values.host,
			reference: { id: referenceId },
			segment: values.segment,
			sequence: values.sequence,
		};

		await incrementLegacyOtuVersion(tx, otuId);
		await insertLegacySequence(tx, document);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Created new sequence ${values.accession} in ${formatIsolateName(isolate)}`,
			methodName: "create_sequence",
			old,
			new: verified,
			referenceId,
			userId,
		});

		return formatSequence(document);
	});
}

/** Update a sequence. */
export async function updateSequence(
	db: Db,
	otuId: string,
	isolateId: string,
	sequenceId: string,
	values: SequenceUpdateRequest,
	userId: number,
): Promise<OtuSequence> {
	return db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const referenceId = reference.id;

		checkSequenceSegment(old, values.segment);

		const isolate = findIsolate(old, isolateId);

		// Scoped to the OTU and isolate in the request, not read by id alone.
		// Authorization is granted against the OTU's reference, so an unscoped read
		// would let a caller with `modify_otu` on one reference edit a sequence
		// belonging to another by naming their own OTU alongside its id. Python
		// reads by id alone and has that hole; there is no reason to carry it over.
		const [stored] = await tx
			.select({ data: legacySequences.data })
			.from(legacySequences)
			.where(
				and(
					eq(legacySequences.id, sequenceId),
					eq(legacySequences.otu_id, otuId),
					eq(legacySequences.isolate_id, isolateId),
				),
			)
			.limit(1);

		if (stored === undefined) {
			throw new SequenceNotFoundError(`Sequence ${sequenceId} not found`);
		}

		const document: SequenceDocument = {
			...stored.data,
			...(values.accession !== undefined && { accession: values.accession }),
			...(values.definition !== undefined && { definition: values.definition }),
			...(values.host !== undefined && { host: values.host }),
			...(values.segment !== undefined && { segment: values.segment }),
			...(values.sequence !== undefined && { sequence: values.sequence }),
		};

		await incrementLegacyOtuVersion(tx, otuId);
		await writeLegacySequence(tx, document);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Edited sequence ${sequenceId} in ${formatIsolateName(isolate)}`,
			methodName: "edit_sequence",
			old,
			new: verified,
			referenceId,
			userId,
		});

		return formatSequence(document);
	});
}

/** Delete a sequence. The gap it leaves in `position` is never renumbered. */
export async function deleteSequence(
	db: Db,
	otuId: string,
	isolateId: string,
	sequenceId: string,
	userId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		const { document: old, reference } = await readOtuWithReference(
			tx,
			otuId,
			true,
		);

		const referenceId = reference.id;

		const isolate = findIsolate(old, isolateId);

		// Scoped for the reason `updateSequence` documents: authorization is held
		// against this OTU's reference, so the delete must not reach a sequence
		// outside it.
		const deleted = await tx
			.delete(legacySequences)
			.where(
				and(
					eq(legacySequences.id, sequenceId),
					eq(legacySequences.otu_id, otuId),
					eq(legacySequences.isolate_id, isolateId),
				),
			)
			.returning({ id: legacySequences.id });

		if (deleted.length === 0) {
			throw new SequenceNotFoundError(`Sequence ${sequenceId} not found`);
		}

		await incrementLegacyOtuVersion(tx, otuId);

		const updated = await joinLegacyOtu(tx, otuId);

		if (updated === undefined) {
			throw new OtuNotFoundError(`OTU ${otuId} not found`);
		}

		const verified = await updateLegacyOtuVerification(tx, updated);

		await addHistory(tx, {
			description: `Removed sequence ${sequenceId} from ${formatIsolateName(isolate)}`,
			methodName: "remove_sequence",
			old,
			new: verified,
			referenceId,
			userId,
		});
	});
}
