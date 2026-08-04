// Reading an OTU's history, and taking OTUs back to the versions an analysis saw
// by reverting the diffs written since. Changes are recorded by `./add.ts`.
//
// The patching is a port of `virtool.history.db.patch_otus_to_versions`, narrowed
// to the patched document. Python returns a `(current, patched)` pair per
// specifier and our only caller reads `patched`.

import type {
	HistoryNested,
	OtuHistory,
	UnbuiltChangesSearchResult,
} from "@virtool/contracts";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	type HistoryRow,
	legacyHistory,
	legacyHistoryDiff,
} from "../db/schema/history";
import { indexes } from "../db/schema/indexes";
import { legacyOtus } from "../db/schema/otus";
import { legacyReferences } from "../db/schema/references";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import {
	joinLegacyOtus,
	type OtuDocument,
	OtuNotFoundError,
} from "../otus/data";
import { type DiffEntry, patch, swap } from "./dictdiffer";

// Re-exported so a caller of `patchOtusToVersions` can name what it gets back
// without also reaching into the OTU data layer.
export type { OtuDocument };

/** An `(otuId, version)` pair identifying one OTU at one point in its history. */
export type OtuSpecifier = { otuId: string; version: number };

/**
 * Thrown when a history change has no `legacy_history_diff` row, so there is
 * nothing to revert with.
 */
export class MissingHistoryDiffError extends AppError {}

/**
 * Thrown when a change's stored diff is not a diff — a `NULL` column, or the
 * `"postgres"` sentinel lifted in place of the diff it stands for. Such a row
 * was never backfilled, and patching around it would silently hand back an OTU
 * at the wrong version.
 */
export class UnbackfilledHistoryDiffError extends AppError {}

/** What a `NULL` `otu_version` stands for: the OTU no longer exists. */
const REMOVED = "removed";

/**
 * The key {@link patchOtusToVersions} returns its results under, so a caller and
 * the implementation cannot disagree about the format. OTU ids are alphanumeric,
 * so the separator cannot collide.
 */
export function otuSpecifierKey(otuId: string, version: number): string {
	return `${otuId}:${version}`;
}

// Reverse the `otu_version` sentinel-to-NULL convention: `NULL` is the
// `"removed"` sentinel, and the stringified integer becomes a number so it can
// be compared against a target version.
//
// A non-numeric `otu_version` is unreachable: the read below casts the column to
// an integer in SQL, so Postgres rejects such a row before it can be coerced
// here.
function coerceOtuVersion(otuVersion: string | null): number | typeof REMOVED {
	if (otuVersion === null) {
		return REMOVED;
	}

	return Number(otuVersion);
}

/**
 * Thrown when a history row is missing something every row must carry: the
 * reference it belongs to, or the version of the index it was built into.
 *
 * Both columns are nullable in the schema for reasons that predate the foreign
 * keys, but a row written by either service always fills them. Python raises on
 * the same condition rather than serving a change with a hole in it.
 */
export class MalformedHistoryRowError extends AppError {}

// The public change id. `legacy_id` carries it on every row either service has
// written; the integer primary key stands in for a row old enough to predate it,
// so a history list renders rather than failing on one unidentifiable change.
function changeId(row: { legacy_id: string | null; id: number }): string {
	return row.legacy_id ?? String(row.id);
}

// One joined history row, as both change listings select it.
type JoinedHistoryRow = {
	id: number;
	legacy_id: string | null;
	createdAt: Date;
	description: string;
	methodName: string;
	otu: string;
	otuName: string;
	otuVersion: string | null;
	indexId: number | null;
	indexVersion: number | null;
	referenceId: number | null;
	referenceName: string | null;
	userId: number;
	userHandle: string;
};

function mapOtuHistory(row: JoinedHistoryRow): OtuHistory {
	if (row.referenceId === null || row.referenceName === null) {
		throw new MalformedHistoryRowError(
			`Change ${changeId(row)} names no reference`,
		);
	}

	if (row.indexId !== null && row.indexVersion === null) {
		throw new MalformedHistoryRowError(
			`Change ${changeId(row)} was built into index ${row.indexId}, which has no version`,
		);
	}

	return {
		id: changeId(row),
		createdAt: row.createdAt,
		description: row.description,
		methodName: row.methodName as OtuHistory["methodName"],
		index:
			row.indexId === null
				? null
				: { id: row.indexId, version: row.indexVersion as number },
		otu: {
			id: row.otu,
			name: row.otuName,
			version: coerceOtuVersion(row.otuVersion),
		},
		reference: { id: row.referenceId, name: row.referenceName },
		user: { id: row.userId, handle: row.userHandle },
	};
}

/**
 * List every change made to an OTU, newest first.
 *
 * The change that removed the OTU sorts above every numbered version — its
 * `otu_version` is `NULL`, and the sort takes nulls first.
 *
 * The user, index, and reference each resolve in the same query. Python attaches
 * the reference with `AttachReferenceTransform`, a second round trip to nest two
 * columns behind a foreign key this query is already positioned to join.
 */
export async function listByOtu(
	db: DbOrTx,
	otuId: string,
): Promise<OtuHistory[]> {
	const [otu] = await db
		.select({ id: legacyOtus.id })
		.from(legacyOtus)
		.where(eq(legacyOtus.id, otuId))
		.limit(1);

	if (otu === undefined) {
		throw new OtuNotFoundError(`OTU ${otuId} not found`);
	}

	const rows = await db
		.select({
			id: legacyHistory.id,
			legacy_id: legacyHistory.legacy_id,
			createdAt: legacyHistory.created_at,
			description: legacyHistory.description,
			methodName: legacyHistory.method_name,
			otu: legacyHistory.otu,
			otuName: legacyHistory.otu_name,
			otuVersion: legacyHistory.otu_version,
			indexId: legacyHistory.index_id,
			indexVersion: indexes.version,
			referenceId: legacyHistory.reference_id,
			referenceName: legacyReferences.name,
			userId: users.id,
			userHandle: users.handle,
		})
		.from(legacyHistory)
		.innerJoin(users, eq(legacyHistory.user_id, users.id))
		.leftJoin(indexes, eq(legacyHistory.index_id, indexes.id))
		.leftJoin(
			legacyReferences,
			eq(legacyHistory.reference_id, legacyReferences.id),
		)
		.where(eq(legacyHistory.otu, otuId))
		.orderBy(
			sql`${legacyHistory.otu_version}::integer desc nulls first`,
			desc(legacyHistory.id),
		);

	return rows.map(mapOtuHistory);
}

/**
 * List a reference's changes that no index build covers yet, newest first.
 *
 * `totalCount` counts every change in the reference, built or not, so a caller
 * can tell "nothing unbuilt" from "no history at all"; `foundCount` counts only
 * the unbuilt ones. Python scopes the two the same way.
 *
 * The join is the one {@link listByOtu} uses. An unbuilt change has no index by
 * definition, so the index columns come back null and `index` is always `null` —
 * the join is kept so the row mapping stays a single shape.
 */
export async function findUnbuiltByReference(
	db: DbOrTx,
	referenceId: number,
	page: number,
	perPage: number,
): Promise<UnbuiltChangesSearchResult> {
	const scoped = eq(legacyHistory.reference_id, referenceId);
	const unbuilt = and(scoped, isNull(legacyHistory.index_id));

	const [totalRows, foundRows, rows] = await Promise.all([
		db.select({ value: count() }).from(legacyHistory).where(scoped),
		db.select({ value: count() }).from(legacyHistory).where(unbuilt),
		db
			.select({
				id: legacyHistory.id,
				legacy_id: legacyHistory.legacy_id,
				createdAt: legacyHistory.created_at,
				description: legacyHistory.description,
				methodName: legacyHistory.method_name,
				otu: legacyHistory.otu,
				otuName: legacyHistory.otu_name,
				otuVersion: legacyHistory.otu_version,
				indexId: legacyHistory.index_id,
				indexVersion: indexes.version,
				referenceId: legacyHistory.reference_id,
				referenceName: legacyReferences.name,
				userId: users.id,
				userHandle: users.handle,
			})
			.from(legacyHistory)
			.innerJoin(users, eq(legacyHistory.user_id, users.id))
			.leftJoin(indexes, eq(legacyHistory.index_id, indexes.id))
			.leftJoin(
				legacyReferences,
				eq(legacyHistory.reference_id, legacyReferences.id),
			)
			.where(unbuilt)
			.orderBy(
				sql`${legacyHistory.otu_version}::integer desc nulls first`,
				desc(legacyHistory.id),
			)
			.offset((page - 1) * perPage)
			.limit(perPage),
	]);

	const totalCount = takeFirstOrThrow(totalRows).value;
	const foundCount = takeFirstOrThrow(foundRows).value;

	return {
		foundCount,
		totalCount,
		page,
		pageCount: foundCount ? Math.ceil(foundCount / perPage) : 0,
		perPage,
		items: rows.map(mapOtuHistory),
	};
}

/**
 * The most recent change made to an OTU, for embedding in the OTU itself, or
 * `null` when it has no history.
 *
 * Ordered the same way as {@link listByOtu}, so a removed OTU's final change
 * wins despite having no numbered version.
 */
export async function getMostRecentChange(
	db: DbOrTx,
	otuId: string,
): Promise<HistoryNested | null> {
	const [row] = await db
		.select({
			id: legacyHistory.id,
			legacy_id: legacyHistory.legacy_id,
			createdAt: legacyHistory.created_at,
			description: legacyHistory.description,
			methodName: legacyHistory.method_name,
			userId: users.id,
			userHandle: users.handle,
		})
		.from(legacyHistory)
		.innerJoin(users, eq(legacyHistory.user_id, users.id))
		.where(eq(legacyHistory.otu, otuId))
		.orderBy(
			sql`${legacyHistory.otu_version}::integer desc nulls first`,
			desc(legacyHistory.id),
		)
		.limit(1);

	if (row === undefined) {
		return null;
	}

	return {
		id: changeId(row),
		createdAt: row.createdAt,
		description: row.description,
		methodName: row.methodName as HistoryNested["methodName"],
		user: { id: row.userId, handle: row.userHandle },
	};
}

/**
 * Read the history rows that patching `lowestVersions` could have to revert,
 * keyed by OTU.
 *
 * One query covers every OTU. Each contributes a predicate matching the changes
 * above the lowest version it is being patched to, which is the most any of its
 * specifiers can need.
 *
 * The version predicate is what preserves the early break of the legacy Mongo
 * cursor: the changes at or below the target are never read, so a
 * heavily-edited OTU still does not load its whole history. Ordered by
 * descending version, the rows it selects are exactly the leading run the break
 * stopped at — a `NULL` `otu_version` is the `"removed"` sentinel and sorts
 * above every numbered version — so nothing dropped could have been reverted.
 */
async function readHistoryToRevert(
	db: DbOrTx,
	lowestVersions: Map<string, number>,
): Promise<Map<string, HistoryRow[]>> {
	const predicates = [...lowestVersions].map(([otuId, version]) =>
		and(
			eq(legacyHistory.otu, otuId),
			or(
				isNull(legacyHistory.otu_version),
				sql`${legacyHistory.otu_version}::integer > ${version}`,
			),
		),
	);

	const rows = await db
		.select()
		.from(legacyHistory)
		.where(or(...predicates))
		.orderBy(
			legacyHistory.otu,
			sql`${legacyHistory.otu_version}::integer desc nulls first`,
			desc(legacyHistory.id),
		);

	const byOtu = new Map<string, HistoryRow[]>();

	for (const row of rows) {
		const forOtu = byOtu.get(row.otu) ?? [];
		forOtu.push(row);
		byOtu.set(row.otu, forOtu);
	}

	return byOtu;
}

// Select the changes to revert to take an OTU back to `version`.
//
// `historyRows` are ordered by descending version and reach further back than
// this version may need, because they cover every version their OTU is being
// patched to. The walk breaks at the first change at or below the target rather
// than filtering the list: the break is what bounds the work.
function changesToRevert(
	historyRows: HistoryRow[],
	version: number,
): HistoryRow[] {
	const changes: HistoryRow[] = [];

	for (const row of historyRows) {
		const otuVersion = coerceOtuVersion(row.otu_version);

		if (otuVersion === REMOVED || otuVersion > version) {
			changes.push(row);
		} else {
			break;
		}
	}

	return changes;
}

/**
 * Resolve the diff for each change in one query, keyed by `legacy_history.id`.
 *
 * Python compares a Mongo change document's `diff` field against the
 * `"postgres"` sentinel before looking the real diff up. That field has no
 * column in `legacy_history` — the diff lives only in `legacy_history_diff` —
 * and Python's own `_change_to_revert` hardcodes the sentinel, so the check is
 * already inert on the path it guards. What it was protecting survives here as
 * the two failures the schema can actually express: a change with no diff row,
 * and a diff row that never received its diff. Both throw rather than patching
 * nothing.
 *
 * The diffs join on the integer `history_id` foreign key rather than on
 * `legacy_id`, which is nullable.
 */
async function resolveDiffs(
	db: DbOrTx,
	changes: HistoryRow[],
): Promise<Map<number, unknown>> {
	const historyIds = [...new Set(changes.map((change) => change.id))];

	if (historyIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			historyId: legacyHistoryDiff.history_id,
			diff: legacyHistoryDiff.diff,
		})
		.from(legacyHistoryDiff)
		.where(inArray(legacyHistoryDiff.history_id, historyIds));

	const resolved = new Map<number, unknown>();

	for (const row of rows) {
		if (row.historyId !== null) {
			resolved.set(row.historyId, row.diff);
		}
	}

	const missing = historyIds.filter((id) => !resolved.has(id));

	if (missing.length > 0) {
		throw new MissingHistoryDiffError(
			`Missing legacy_history_diff rows for changes: ${missing.join(", ")}`,
		);
	}

	return resolved;
}

function describeChange(change: HistoryRow): string {
	return change.legacy_id ?? String(change.id);
}

// A `create` or `remove` change stores the whole OTU document as its diff.
function toDocumentDiff(change: HistoryRow, diff: unknown): OtuDocument {
	if (diff === null || typeof diff !== "object" || Array.isArray(diff)) {
		throw new UnbackfilledHistoryDiffError(
			`Change ${describeChange(change)} stores no OTU document to revert to`,
		);
	}

	return diff as OtuDocument;
}

// Every other change stores a dictdiffer diff: a list of `[action, path,
// changes]` triples. The `"postgres"` sentinel and a `NULL` column both fail
// here.
function toEntryDiff(change: HistoryRow, diff: unknown): DiffEntry[] {
	if (!Array.isArray(diff)) {
		throw new UnbackfilledHistoryDiffError(
			`Change ${describeChange(change)} stores ${JSON.stringify(diff)} where a diff was expected`,
		);
	}

	return diff as DiffEntry[];
}

// Stamp the authoritative reference id onto the OTU and each of its sequences.
//
// A joined OTU reconstructed from a diff carries whatever `reference.id` the
// historical snapshot held, which may be a stale legacy string. An OTU's parent
// reference never changes, so the current id is restamped over it.
//
// Python mutates the document in place. Rebuilding it instead keeps a patched
// OTU from writing through structure it shares with the diff it was recovered
// from, which two specifiers for the same OTU both read.
function stampReference(otu: OtuDocument, referenceId: unknown): OtuDocument {
	const isolates = otu.isolates;

	if (!Array.isArray(isolates)) {
		return { ...otu, reference: { id: referenceId } };
	}

	return {
		...otu,
		reference: { id: referenceId },
		isolates: isolates.map((isolate) => {
			const embedded = isolate as Record<string, unknown>;
			const sequences = embedded.sequences;

			if (!Array.isArray(sequences)) {
				return embedded;
			}

			return {
				...embedded,
				sequences: sequences.map((sequence) => ({
					...(sequence as Record<string, unknown>),
					reference: { id: referenceId },
				})),
			};
		}),
	};
}

// Revert `changes` from `current` to recover the patched OTU. `latestChange` is
// the OTU's most recent history row, and carries the parent reference for an OTU
// with no live document left to read it from.
function applyChangesToRevert(
	current: OtuDocument,
	changes: HistoryRow[],
	diffs: Map<number, unknown>,
	latestChange: HistoryRow | undefined,
): OtuDocument | null {
	let patched: OtuDocument | null = current;

	for (const change of changes) {
		const diff = diffs.get(change.id);

		if (change.method_name === "remove") {
			patched = toDocumentDiff(change, diff);
		} else if (change.method_name === "create") {
			patched = null;
		} else {
			patched = patch(swap(toEntryDiff(change, diff)), patched);
		}
	}

	// Python guards the stamping on the truthiness of the patched document, which
	// also catches the empty one an OTU with neither a row nor any history above
	// the target reduces to. Both mean the same thing to a caller — the OTU did
	// not exist at that version — so both come back as null.
	if (patched === null || Object.keys(patched).length === 0) {
		return null;
	}

	// The live OTU's reference is authoritative when it still exists; an OTU that
	// was removed falls back to its latest change. Only a reverted change can
	// leave a patched OTU without a live one, so there is always a latest change
	// to fall back to by the time this is reached. Python also falls back to the
	// legacy string `reference` column, which the mirror does not declare because
	// upstream stopped writing it.
	const live = current.reference as Record<string, unknown> | undefined;

	const referenceId =
		Object.keys(current).length > 0
			? live?.id
			: (latestChange?.reference_id ?? null);

	return stampReference(patched, referenceId ?? null);
}

/**
 * Take each OTU identified by `specifiers` back to its version, keyed by
 * {@link otuSpecifierKey}. Every specifier is present in the returned map; an
 * OTU that did not exist at that version maps to null. The same OTU may appear
 * under more than one version.
 *
 * The whole set resolves in a fixed handful of queries — two to join the OTUs,
 * one for the history, one for the diffs — however many OTUs are asked for. The
 * per-OTU reads this replaces are what made formatting a pathoscope analysis
 * saturate the connection pool and slow every request the server was handling
 * alongside it.
 *
 * A target `version` is an OTU `version` and so is always an integer, never the
 * `"removed"` sentinel a history row's `otu_version` can carry.
 *
 * Returned documents must be treated as read-only; they may share structure with
 * one another.
 */
export async function patchOtusToVersions(
	db: DbOrTx,
	specifiers: OtuSpecifier[],
): Promise<Map<string, OtuDocument | null>> {
	const unique = new Map<string, OtuSpecifier>();

	for (const specifier of specifiers) {
		unique.set(otuSpecifierKey(specifier.otuId, specifier.version), specifier);
	}

	if (unique.size === 0) {
		return new Map();
	}

	const currentOtus = await joinLegacyOtus(
		db,
		[...unique.values()].map((specifier) => specifier.otuId),
	);

	const patched = new Map<string, OtuDocument | null>();
	const toPatch = new Map<string, OtuSpecifier>();

	for (const [key, specifier] of unique) {
		const current = currentOtus.get(specifier.otuId);

		// An OTU already at the target version needs no history read at all.
		if (current !== undefined && current.version === specifier.version) {
			patched.set(key, current);
		} else {
			toPatch.set(key, specifier);
		}
	}

	if (toPatch.size === 0) {
		return patched;
	}

	const lowestVersions = new Map<string, number>();

	for (const { otuId, version } of toPatch.values()) {
		const lowest = lowestVersions.get(otuId);

		if (lowest === undefined || version < lowest) {
			lowestVersions.set(otuId, version);
		}
	}

	const historyRows = await readHistoryToRevert(db, lowestVersions);

	const changes = new Map<string, HistoryRow[]>(
		[...toPatch].map(([key, specifier]) => [
			key,
			changesToRevert(
				historyRows.get(specifier.otuId) ?? [],
				specifier.version,
			),
		]),
	);

	// One query for every specifier's diffs, so an OTU patched to two versions
	// reads the diffs they share once.
	const diffs = await resolveDiffs(db, [...changes.values()].flat());

	for (const [key, specifier] of toPatch) {
		const rows = historyRows.get(specifier.otuId) ?? [];

		patched.set(
			key,
			applyChangesToRevert(
				currentOtus.get(specifier.otuId) ?? {},
				changes.get(key) ?? [],
				diffs,
				rows[0],
			),
		);
	}

	return patched;
}
