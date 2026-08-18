// Reading and building reference indexes.
//
// A port of `virtool.indexes.db`, `virtool.indexes.data`, and the index half of
// `virtool.references.data`, both halves of a build included: `createIndex`
// inserts the pending row and creates the task, and `generateTaskIndex` is what
// that task runs — patching every OTU in the manifest, writing the artifact to
// object storage, and flipping `ready`.

import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import type {
	Index,
	IndexContributor,
	IndexFile,
	IndexMinimal,
	IndexOtu,
	IndexSearchResult,
} from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import {
	REFERENCE_SQLITE_GZIP_FILE_NAME,
	type IndexOtu as SnapshotOtu,
} from "@virtool/sqlite";
import {
	deleteKeys,
	mintStorageKey,
	type StorageBackend,
} from "@virtool/storage";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	inArray,
	isNull,
	sql,
} from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { legacyHistory } from "../db/schema/history";
import { indexes, indexFiles } from "../db/schema/indexes";
import { legacyOtus } from "../db/schema/otus";
import { legacyReferences } from "../db/schema/references";
import { tasks } from "../db/schema/tasks";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import {
	type OtuSpecifier,
	otuSpecifierKey,
	patchOtusToVersions,
} from "../history/data";
import {
	ReferenceArchivedError,
	ReferenceNotFoundError,
} from "../references/data";
import { createTask } from "../tasks/data";
import { type OtuChunk, streamArtifact } from "./artifact";
import { toSnapshotOtu, writeIndexSnapshot } from "./snapshot";

/** Thrown when a requested index does not exist. */
export class IndexNotFoundError extends AppError {}

/**
 * Thrown when a reference already has a build that has not finished. Only one
 * may be in flight at a time — a second would race the first to stamp the same
 * unbuilt changes.
 */
export class IndexBuildInProgressError extends AppError {}

/** Thrown when a reference has OTUs a curator has not verified yet. */
export class UnverifiedOtusError extends AppError {}

/** Thrown when a reference has no changes for a build to include. */
export class NoUnbuiltChangesError extends AppError {}

/**
 * Thrown when a build is not one a task may finish — backed by a job, or by
 * neither a job nor a task.
 */
export class IndexBuildTypeError extends AppError {}

/**
 * Thrown when the manifest names an OTU version history cannot produce.
 *
 * A manifest entry is proof the OTU existed at that version, so this is a
 * corrupted manifest or corrupted history rather than a routine miss, and the
 * build fails rather than publishing an artifact with a hole in it.
 */
export class IndexManifestError extends AppError {}

/** Options accepted by {@link findIndexes}. */
export type FindIndexesOptions = {
	/** Restrict the page to one reference's indexes */
	referenceId?: number;

	/** The one-indexed page to return */
	page: number;

	/** The number of indexes per page */
	perPage: number;

	/** Lifecycle filter on the index's reference; ignored when `referenceId` is set */
	archived?: boolean;
};

// The reference and user each resolve in the same query the indexes are read
// with. Python attaches both with a transform, a second and third round trip to
// nest two columns behind foreign keys this query is already positioned to join.
function selectIndexes(db: DbOrTx) {
	return db
		.select({
			id: indexes.id,
			version: indexes.version,
			createdAt: indexes.created_at,
			ready: indexes.ready,
			manifest: indexes.manifest,
			referenceId: legacyReferences.id,
			referenceName: legacyReferences.name,
			userId: users.id,
			userHandle: users.handle,
		})
		.from(indexes)
		.innerJoin(legacyReferences, eq(indexes.reference_id, legacyReferences.id))
		.innerJoin(users, eq(indexes.user_id, users.id));
}

type IndexJoinRow = {
	id: number;
	version: number;
	createdAt: Date;
	ready: boolean;
	manifest: Record<string, number>;
	referenceId: number;
	referenceName: string;
	userId: number;
	userHandle: string;
};

/** The change and modified-OTU counts for one build. */
type IndexCounts = { changeCount: number; modifiedOtuCount: number };

const NO_COUNTS: IndexCounts = { changeCount: 0, modifiedOtuCount: 0 };

function mapMinimal(row: IndexJoinRow, counts: IndexCounts): IndexMinimal {
	return {
		id: row.id,
		version: row.version,
		changeCount: counts.changeCount,
		createdAt: row.createdAt,
		modifiedOtuCount: counts.modifiedOtuCount,
		ready: row.ready,
		reference: { id: row.referenceId, name: row.referenceName },
		user: { id: row.userId, handle: row.userHandle },
	};
}

// How many changes each build included, and how many distinct OTUs they touched.
// A build with no history rows is absent from the result and falls back to zero,
// matching Python's inner join.
async function getIndexCounts(
	db: DbOrTx,
	indexIds: number[],
): Promise<Map<number, IndexCounts>> {
	if (indexIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			indexId: legacyHistory.index_id,
			changeCount: count(),
			modifiedOtuCount: countDistinct(legacyHistory.otu),
		})
		.from(legacyHistory)
		.where(inArray(legacyHistory.index_id, indexIds))
		.groupBy(legacyHistory.index_id);

	const counts = new Map<number, IndexCounts>();

	for (const row of rows) {
		if (row.indexId !== null) {
			counts.set(row.indexId, {
				changeCount: row.changeCount,
				modifiedOtuCount: row.modifiedOtuCount,
			});
		}
	}

	return counts;
}

/** A reference's totals for the changes no build covers yet. */
type UnbuiltStats = {
	changeCount: number;
	modifiedOtuCount: number;
	totalOtuCount: number;
};

// The counts a list view needs to decide whether a rebuild is worth offering.
// Scoped to a reference when one is given, global otherwise; the archived filter
// deliberately does not apply, matching Python.
async function getUnbuiltStats(
	db: DbOrTx,
	referenceId?: number,
): Promise<UnbuiltStats> {
	const historyFilter =
		referenceId === undefined
			? isNull(legacyHistory.index_id)
			: and(
					isNull(legacyHistory.index_id),
					eq(legacyHistory.reference_id, referenceId),
				);

	const otuFilter =
		referenceId === undefined
			? undefined
			: eq(legacyOtus.reference_id, referenceId);

	const [changeRows, otuRows] = await Promise.all([
		db
			.select({
				changeCount: count(),
				modifiedOtuCount: countDistinct(legacyHistory.otu),
			})
			.from(legacyHistory)
			.where(historyFilter),
		db.select({ value: count() }).from(legacyOtus).where(otuFilter),
	]);

	const changes = takeFirstOrThrow(changeRows);

	return {
		changeCount: changes.changeCount,
		modifiedOtuCount: changes.modifiedOtuCount,
		totalOtuCount: takeFirstOrThrow(otuRows).value,
	};
}

// Restrict to indexes whose reference matches an archived state. Python
// expresses this as a subquery rather than a join so the archived filter cannot
// change the row count.
function archivedFilter(db: DbOrTx, archived: boolean) {
	return inArray(
		indexes.reference_id,
		db
			.select({ id: legacyReferences.id })
			.from(legacyReferences)
			.where(eq(legacyReferences.archived, archived)),
	);
}

/**
 * List indexes, newest first, or by descending version within a reference.
 *
 * A reference-scoped page ignores `archived`: the caller already named the
 * reference, so filtering on its lifecycle could only empty the page.
 */
export async function findIndexes(
	db: Db,
	{ referenceId, page, perPage, archived }: FindIndexesOptions,
): Promise<IndexSearchResult> {
	const scoped = referenceId !== undefined;

	const baseFilter = scoped ? eq(indexes.reference_id, referenceId) : undefined;

	const foundFilter =
		scoped || archived === undefined
			? baseFilter
			: archivedFilter(db, archived);

	const orderBy = scoped
		? [desc(indexes.version)]
		: [desc(indexes.created_at), desc(indexes.id)];

	const [totalRows, foundRows, rows, unbuiltStats] = await Promise.all([
		db.select({ value: count() }).from(indexes).where(baseFilter),
		// Without an archived filter the found count equals the total count, so
		// skip the redundant query and reuse totalCount below.
		foundFilter === baseFilter
			? undefined
			: db.select({ value: count() }).from(indexes).where(foundFilter),
		selectIndexes(db)
			.where(foundFilter)
			.orderBy(...orderBy)
			.offset((page - 1) * perPage)
			.limit(perPage),
		getUnbuiltStats(db, referenceId),
	]);

	const totalCount = takeFirstOrThrow(totalRows).value;
	const foundCount = foundRows ? takeFirstOrThrow(foundRows).value : totalCount;

	const counts = await getIndexCounts(
		db,
		rows.map((row) => row.id),
	);

	return {
		foundCount,
		totalCount,
		page,
		pageCount: foundCount ? Math.ceil(foundCount / perPage) : 0,
		perPage,
		items: rows.map((row) => mapMinimal(row, counts.get(row.id) ?? NO_COUNTS)),
		...unbuiltStats,
	};
}

/**
 * List every finished index, oldest first.
 *
 * Unpaginated by design: the caller is a selector offering the indexes an
 * analysis can run against, and it groups them by reference to pick the newest
 * of each, so a page boundary would silently drop candidates.
 */
export async function listReadyIndexes(
	db: Db,
	archived?: boolean,
): Promise<IndexMinimal[]> {
	const filter =
		archived === undefined
			? eq(indexes.ready, true)
			: and(eq(indexes.ready, true), archivedFilter(db, archived));

	const rows = await selectIndexes(db)
		.where(filter)
		.orderBy(asc(indexes.created_at), asc(indexes.id));

	const counts = await getIndexCounts(
		db,
		rows.map((row) => row.id),
	);

	return rows.map((row) => mapMinimal(row, counts.get(row.id) ?? NO_COUNTS));
}

// The users who contributed the changes a build included, with their counts.
async function getContributors(
	db: DbOrTx,
	indexId: number,
): Promise<IndexContributor[]> {
	const rows = await db
		.select({
			id: users.id,
			handle: users.handle,
			count: count(),
		})
		.from(users)
		.innerJoin(legacyHistory, eq(legacyHistory.user_id, users.id))
		.where(eq(legacyHistory.index_id, indexId))
		.groupBy(users.id, users.handle)
		.orderBy(asc(users.id));

	return rows;
}

// The OTUs a build included changes to, named as of the latest change to each.
//
// The name comes from the change with the highest `otu_version`, taking nulls
// last — a `NULL` version is the "removed" sentinel, and the name it carries is
// the one the OTU had before it was deleted. Python reaches the same row with
// `DISTINCT ON` plus a window count; one aggregate does both here.
async function getIndexOtus(db: DbOrTx, indexId: number): Promise<IndexOtu[]> {
	const rows = await db
		.select({
			id: legacyHistory.otu,
			name: sql<string>`(array_agg(${legacyHistory.otu_name} order by ${legacyHistory.otu_version}::integer desc nulls last))[1]`,
			changeCount: count(),
		})
		.from(legacyHistory)
		.where(eq(legacyHistory.index_id, indexId))
		.groupBy(legacyHistory.otu);

	return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// The files a finished build produced. The download URL is the path the raw
// route in `./download` answers on, so it is site-relative and the client links
// to it unmodified.
async function getIndexFiles(
	db: DbOrTx,
	indexId: number,
): Promise<IndexFile[]> {
	const rows = await db
		.select({
			id: indexFiles.id,
			name: indexFiles.name,
			size: indexFiles.size,
			storageKey: indexFiles.storage_key,
			type: indexFiles.type,
		})
		.from(indexFiles)
		.where(eq(indexFiles.index_id, indexId));

	return rows.map((row) => ({
		downloadUrl: `/indexes/${indexId}/files/${row.name}`,
		id: row.id,
		index: indexId,
		name: row.name,
		size: row.size,
		storageKey: row.storageKey,
		type: row.type ?? "",
	}));
}

export async function getIndex(db: Db, indexId: number): Promise<Index> {
	const [row] = await selectIndexes(db).where(eq(indexes.id, indexId)).limit(1);

	if (!row) {
		throw new IndexNotFoundError();
	}

	const [counts, contributors, otus, files] = await Promise.all([
		getIndexCounts(db, [indexId]),
		getContributors(db, indexId),
		getIndexOtus(db, indexId),
		getIndexFiles(db, indexId),
	]);

	return {
		...mapMinimal(row, counts.get(indexId) ?? NO_COUNTS),
		contributors,
		files,
		manifest: row.manifest,
		otus,
	};
}

// The files a finished build produces, and so the only names the download route
// will serve. Mirrors Python's `INDEX_FILE_NAMES`; a build's other artifacts
// stay unreachable even once a row exists for them.
const INDEX_FILE_NAMES = new Set([
	"reference.fa.gz",
	"reference.json.gz",
	"reference.1.bt2",
	"reference.2.bt2",
	"reference.3.bt2",
	"reference.4.bt2",
	"reference.rev.1.bt2",
	"reference.rev.2.bt2",
	"reference-v2.json.gz",
	REFERENCE_SQLITE_GZIP_FILE_NAME,
]);

/**
 * The reference a build belongs to, or `null` when the build does not exist.
 *
 * The download route resolves it to decide who may read the build's files: an
 * index is only as visible as the reference it was built from.
 */
export async function getIndexReferenceId(
	db: DbOrTx,
	indexId: number,
): Promise<number | null> {
	const [row] = await db
		.select({ referenceId: indexes.reference_id })
		.from(indexes)
		.where(eq(indexes.id, indexId))
		.limit(1);

	return row?.referenceId ?? null;
}

/**
 * The storage key of one of a build's files, or `null` when the build has no
 * such file.
 *
 * The key is read off the row the name matched, never composed from the
 * caller's input. The `INDEX_FILE_NAMES` guard is kept as a cheap rejection of
 * anything a build never produces.
 */
export async function getIndexFileKey(
	db: DbOrTx,
	indexId: number,
	filename: string,
): Promise<string | null> {
	if (!INDEX_FILE_NAMES.has(filename)) {
		return null;
	}

	const [row] = await db
		.select({ storageKey: indexFiles.storage_key })
		.from(indexFiles)
		.where(and(eq(indexFiles.index_id, indexId), eq(indexFiles.name, filename)))
		.limit(1);

	return row?.storageKey ?? null;
}

// Whether the reference has a build that has not finished.
async function hasBuildInProgress(
	db: DbOrTx,
	referenceId: number,
): Promise<boolean> {
	const rows = await db
		.select({ id: indexes.id })
		.from(indexes)
		.where(and(eq(indexes.reference_id, referenceId), eq(indexes.ready, false)))
		.limit(1);

	return rows.length > 0;
}

// The next version number for a reference's builds, counting from zero.
//
// Monotonic: deleting a build does not free its number, because the maximum is
// taken over what remains rather than the count.
async function getNextVersion(
	db: DbOrTx,
	referenceId: number,
): Promise<number> {
	const rows = await db
		.select({ value: sql<number>`coalesce(max(${indexes.version}), -1) + 1` })
		.from(indexes)
		.where(eq(indexes.reference_id, referenceId));

	return takeFirstOrThrow(rows).value;
}

/**
 * Start an index build for a reference and return the index it inserted.
 *
 * The build itself is the Python `create_index` task's work; this mints the row
 * it claims, stamps every unbuilt change with the build that will include it,
 * and pins the manifest to the OTU versions live once those changes are claimed.
 *
 * Concurrency is what most of this guards. Two builds of one reference would
 * each stamp the other's changes and collide on the `(reference_id, version)`
 * unique constraint, so the write runs under a transaction-scoped advisory lock
 * keyed on the reference — the same key Python takes, so a build started from
 * either service excludes one started from the other. The in-progress check runs
 * both before the lock (a cheap rejection) and again under it (the one that is
 * actually race-free).
 *
 * That lock excludes other builds, not OTU editors, so the manifest is read
 * *after* the history rows are claimed rather than before. An edit landing
 * between the two is then either unclaimed and absent from the manifest (built
 * next time), or claimed and present. Reading the manifest first admits the one
 * ordering that loses a change outright: claimed by this build, but at a version
 * the manifest — and so the artifact Python writes — does not carry.
 */
export async function createIndex(
	db: Db,
	referenceId: number,
	userId: number,
): Promise<Index> {
	const [reference] = await db
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

	if (await hasBuildInProgress(db, referenceId)) {
		throw new IndexBuildInProgressError("Index build already in progress");
	}

	const [unverifiedRows, unbuiltRows] = await Promise.all([
		db
			.select({ id: legacyOtus.id })
			.from(legacyOtus)
			.where(
				and(
					eq(legacyOtus.reference_id, referenceId),
					eq(legacyOtus.verified, false),
				),
			)
			.limit(1),
		db
			.select({ id: legacyHistory.id })
			.from(legacyHistory)
			.where(
				and(
					eq(legacyHistory.reference_id, referenceId),
					isNull(legacyHistory.index_id),
				),
			)
			.limit(1),
	]);

	if (unverifiedRows.length > 0) {
		throw new UnverifiedOtusError("There are unverified OTUs");
	}

	if (unbuiltRows.length === 0) {
		throw new NoUnbuiltChangesError("There are no unbuilt changes");
	}

	const indexId = await db.transaction(async (tx) => {
		const lockRows = await tx.execute<{ locked: boolean }>(
			sql`select pg_try_advisory_xact_lock(hashtext(${`index_build:${referenceId}`})) as locked`,
		);

		if (!lockRows[0]?.locked) {
			throw new IndexBuildInProgressError("Index build already in progress");
		}

		if (await hasBuildInProgress(tx, referenceId)) {
			throw new IndexBuildInProgressError("Index build already in progress");
		}

		const taskId = await createTask(tx, "create_index");

		const index = takeFirstOrThrow(
			await tx
				.insert(indexes)
				.values({
					version: await getNextVersion(tx, referenceId),
					created_at: new Date(),
					// Filled in below, once this build owns its changes.
					manifest: {},
					ready: false,
					// Dead, but still `NOT NULL` until Python's cleanup revision drops
					// it. Each of the build's files records its own complete key; this
					// is no longer a prefix anything is composed from.
					storage_key: randomUUID().replaceAll("-", ""),
					reference_id: referenceId,
					user_id: userId,
					task_id: taskId,
				})
				.returning({ id: indexes.id }),
		);

		// Every change the reference has accumulated belongs to this build now.
		await tx
			.update(legacyHistory)
			.set({ index_id: index.id })
			.where(
				and(
					eq(legacyHistory.reference_id, referenceId),
					isNull(legacyHistory.index_id),
				),
			);

		// The OTU versions the build is pinned to. Read after the claim above, so
		// no change this build owns can be missing from it.
		const otuRows = await tx
			.select({ id: legacyOtus.id, version: legacyOtus.version })
			.from(legacyOtus)
			.where(eq(legacyOtus.reference_id, referenceId));

		const manifest: Record<string, number> = {};

		for (const otu of otuRows) {
			manifest[otu.id] = otu.version;
		}

		await tx.update(indexes).set({ manifest }).where(eq(indexes.id, index.id));

		// The task carries the index it is to build. It is stamped after the insert
		// because the id does not exist until then, and the task has to exist first
		// so the index can point back at it.
		await tx
			.update(tasks)
			.set({ context: { index_id: index.id } })
			.where(eq(tasks.id, taskId));

		return index.id;
	});

	return getIndex(db, indexId);
}

// Python's `OTU_ID_CHUNK_SIZE`. It bounds both halves of a build: how many OTU
// documents are held at once while the artifact streams, and how many ids go
// into one `last_indexed_version` statement.
const OTU_ID_CHUNK_SIZE = 500;

/** The gzipped JSON a finished build publishes, beside its snapshot. */
const REFERENCE_JSON_V2_FILE_NAME = "reference-v2.json.gz";

// The reference envelope, with `created_at` rendered in Postgres rather than
// from a `Date`.
//
// Two things go wrong reading it as a `Date`. postgres.js parses a `timestamp
// without time zone` with `new Date(x)`, and the wire text carries no offset, so
// V8's fallback reads it as *local* time and a process outside UTC shifts every
// timestamp in the artifact by its offset. And `toISOString` always writes
// exactly three fractional digits, where orjson writes six or, when there are no
// microseconds at all, none — and a `Date` has already truncated the other three
// by then. Rendering in SQL sidesteps both, and matches Python byte for byte.
async function readArtifactReference(db: DbOrTx, referenceId: number) {
	const [row] = await db
		.select({
			id: legacyReferences.id,
			name: legacyReferences.name,
			organism: legacyReferences.organism,
			createdAt: sql<string>`
				to_char(${legacyReferences.created_at}, 'YYYY-MM-DD"T"HH24:MI:SS')
				|| case
					when to_char(${legacyReferences.created_at}, 'US') = '000000' then ''
					else '.' || to_char(${legacyReferences.created_at}, 'US')
				end
				|| 'Z'
			`,
		})
		.from(legacyReferences)
		.where(eq(legacyReferences.id, referenceId))
		.limit(1);

	return row;
}

// The manifest as ordered pairs, in the order Python iterates it.
//
// The order is the artifact's OTU order, and so the order of every downstream
// artifact built from it — including which isolate `cd-hit-est` keeps as a
// cluster representative. Python gets it from `json.loads`, which preserves the
// JSONB text order. Reading the column into a JavaScript object would not:
// `JSON.parse` hoists array-index-like keys to the front and sorts them
// numerically, and an eight-character OTU id drawn from digits and lowercase
// letters is all digits often enough that a real reference has one.
async function readManifestOrder(
	db: DbOrTx,
	indexId: number,
): Promise<OtuSpecifier[]> {
	return db.execute<OtuSpecifier>(sql`
		select entry.key as "otuId", (entry.value #>> '{}')::int as version
		from ${indexes},
			jsonb_each(${indexes.manifest}) with ordinality as entry(key, value, ord)
		where ${indexes.id} = ${indexId}
		order by entry.ord
	`);
}

// Stamp `last_indexed_version` on every OTU of the reference whose `version` has
// moved since the last build.
//
// The value lives twice on `legacy_otus` — in the promoted column and in the
// `data` JSONB the OTU document is recovered from — and both are written by the
// same statement, so they cannot come out of a stamp disagreeing.
//
// `jsonb_set` on the one key is also the only correct write: `data` is verbatim
// Mongo, and reading the document out, mutating it and writing it back would
// round-trip the whole shape through this side's JSON handling. The diffs
// already recorded against it address it as Python wrote it.
async function stampLastIndexedVersions(
	tx: DbOrTx,
	referenceId: number,
): Promise<void> {
	const rows = await tx
		.select({ id: legacyOtus.id, version: legacyOtus.version })
		.from(legacyOtus)
		.where(
			and(
				eq(legacyOtus.reference_id, referenceId),
				sql`${legacyOtus.version} is distinct from ${legacyOtus.last_indexed_version}`,
			),
		);

	const idsByVersion = new Map<number, string[]>();

	for (const { id, version } of rows) {
		const ids = idsByVersion.get(version);

		if (ids === undefined) {
			idsByVersion.set(version, [id]);
		} else {
			ids.push(id);
		}
	}

	for (const [version, ids] of idsByVersion) {
		for (let start = 0; start < ids.length; start += OTU_ID_CHUNK_SIZE) {
			await tx
				.update(legacyOtus)
				.set({
					last_indexed_version: version,
					data: sql`jsonb_set(${legacyOtus.data}, '{last_indexed_version}', to_jsonb(${version}::int))`,
				})
				.where(
					inArray(legacyOtus.id, ids.slice(start, start + OTU_ID_CHUNK_SIZE)),
				);
		}
	}
}

/**
 * Finish a task-backed build: write its artifacts and mark it ready.
 *
 * The whole of what the `create_index` task runs. It patches every OTU in the
 * manifest to the version the manifest pins it to, writes both artifacts to
 * object storage — the `reference-snapshot.v1.sqlite.gz` every analysis
 * decompresses and reads and the `reference-v2.json.gz` beside it — registers a
 * row for each and flips `ready`.
 *
 * **A build publishes both files or neither.** They are registered in one
 * transaction with the `ready` flip, so there is no state where an index says it
 * is analysable and the snapshot is missing. That state is what a workflow
 * cannot recover from: it fails the run at its first step, and the only fix is
 * to build the index again.
 *
 * `onProgress` reports percent complete on chunk boundaries, the snapshot taking
 * the first half of the range and the gzipped JSON the second. It is the seam a
 * task body bridges to its step reporter; nothing here knows a task exists.
 *
 * An **already-ready index is a successful no-op**. A claim is a lease, so a
 * body may re-run from step zero after its work has already completed and
 * committed — a reclaim is concurrent rather than successive — and failing it
 * would show a red error against an index that is perfectly fine.
 *
 * Only the **integer** id is accepted. Nothing enqueues the stringified legacy
 * form: `createIndex` writes `{ index_id: index.id }`.
 */
export async function generateTaskIndex(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	indexId: number,
	onProgress?: (percent: number) => Promise<void>,
): Promise<void> {
	const [row] = await db
		.select({
			jobId: indexes.job_id,
			ready: indexes.ready,
			referenceId: indexes.reference_id,
			taskId: indexes.task_id,
		})
		.from(indexes)
		.where(eq(indexes.id, indexId))
		.limit(1);

	if (row === undefined) {
		throw new IndexNotFoundError("Index does not exist");
	}

	// The `ck_indexes_job_or_task` CHECK constraint already makes "both set"
	// impossible, so only "neither" is reachable — a legacy build whose job was
	// deleted before the jobs migration. Python's message covers both and the
	// constraint is not this repo's to rely on, so both are kept.
	if ((row.jobId === null) === (row.taskId === null)) {
		throw new IndexBuildTypeError(
			"Index must be backed by exactly one job or task build",
		);
	}

	if (row.jobId !== null) {
		throw new IndexBuildTypeError("Index must be backed by a task build");
	}

	if (row.ready) {
		logger.info({ indexId }, "index is already ready; nothing to build");

		return;
	}

	const reference = await readArtifactReference(db, row.referenceId);

	if (reference === undefined) {
		throw new ReferenceNotFoundError("Reference does not exist");
	}

	const specifiers = await readManifestOrder(db, indexId);

	// Minted, never composed. A rebuild therefore writes new objects rather than
	// overwriting the previous ones, which is what the post-commit delete below is
	// for.
	const artifactKey = mintStorageKey("indexes", indexId);
	const snapshotKey = mintStorageKey("indexes", indexId);

	// The manifest is walked once per artifact rather than once in total. Holding
	// the patched documents for a second consumer would put the whole reference in
	// the heap, which is the one thing this build refuses to do; teeing the
	// generator would do the same wherever the two consumers drift apart. The
	// second walk costs a repeat of the patch reads and nothing else.
	async function* chunks(
		reportFrom: number,
		reportTo: number,
	): AsyncIterable<OtuChunk> {
		let patched = 0;

		for (let start = 0; start < specifiers.length; start += OTU_ID_CHUNK_SIZE) {
			const slice = specifiers.slice(start, start + OTU_ID_CHUNK_SIZE);

			// One batched read per chunk, resolving a whole chunk in a fixed handful
			// of queries rather than patching each OTU on its own.
			const documents = await patchOtusToVersions(db, slice);

			yield slice.map(({ otuId, version }) => {
				const document = documents.get(otuSpecifierKey(otuId, version));

				if (!document) {
					throw new IndexManifestError(
						`OTU ${otuId} could not be patched to the version the manifest pins it to`,
					);
				}

				return document;
			});

			patched += slice.length;

			await onProgress?.(
				reportFrom + (patched / specifiers.length) * (reportTo - reportFrom),
			);

			// Serializing a chunk is a synchronous stretch, and the runner's heartbeat
			// is a timer. Without a macrotask boundary between chunks a large
			// reference starves it and the task is reclaimed out from under itself.
			await setImmediate();
		}
	}

	async function* snapshotOtus(): AsyncIterable<SnapshotOtu> {
		for await (const chunk of chunks(0, 50)) {
			for (const document of chunk) {
				yield toSnapshotOtu(document);
			}
		}
	}

	// Storage cannot participate in the transaction below. A write that lands
	// where the commit does not — a failure here, or a hard exit between the two —
	// leaves an object no row names, which the orphan sweep collects. Deleting it
	// here would only cover the half of that where this process survives.
	//
	// The snapshot goes first because it is the artifact an analysis needs. A
	// build that dies between the two writes is unfinished either way — `ready`
	// is flipped by the commit below and by nothing else — so the order costs
	// nothing and puts the failure that matters first.
	const snapshotSize = await writeIndexSnapshot(
		storage,
		snapshotKey,
		{
			created_at: reference.createdAt,
			// A wire value rather than a fact about the row: every reference this
			// side builds an index for is a genome, and the field is one the
			// analysis workflows read back.
			data_type: "genome",
			id: String(reference.id),
			name: reference.name,
			organism: reference.organism,
		},
		snapshotOtus(),
	);

	const artifactSize = await storage.write(
		artifactKey,
		streamArtifact(
			{
				_id: reference.id,
				created_at: reference.createdAt,
				name: reference.name,
				organism: reference.organism,
			},
			chunks(50, 100),
		),
	);

	const written = [
		{
			key: artifactKey,
			name: REFERENCE_JSON_V2_FILE_NAME,
			size: artifactSize,
			type: "json",
		},
		{
			key: snapshotKey,
			name: REFERENCE_SQLITE_GZIP_FILE_NAME,
			size: snapshotSize,
			type: "sqlite",
		},
	] as const;

	const replacedKeys = await db.transaction(async (tx) => {
		const existing = await tx
			.select({ name: indexFiles.name, storageKey: indexFiles.storage_key })
			.from(indexFiles)
			.where(
				and(
					eq(indexFiles.index_id, indexId),
					inArray(
						indexFiles.name,
						written.map(({ name }) => name),
					),
				),
			);

		for (const { key, name, size, type } of written) {
			await tx
				.insert(indexFiles)
				.values({
					index: String(indexId),
					index_id: indexId,
					name,
					size,
					storage_key: key,
					type,
				})
				.onConflictDoUpdate({
					target: [indexFiles.index_id, indexFiles.name],
					set: { size, storage_key: key, type },
				});
		}

		await stampLastIndexedVersions(tx, row.referenceId);

		await tx
			.update(indexes)
			.set({ ready: true })
			.where(eq(indexes.id, indexId));

		return existing.map(({ storageKey }) => storageKey);
	});

	// Committed, so the rows now name the new objects and the ones they replaced
	// are orphans. Cleaning them up must not fail a build that otherwise
	// succeeded.
	if (replacedKeys.length > 0) {
		for (const failure of await deleteKeys(storage, replacedKeys)) {
			logger.error(
				{ err: failure.error, indexId, key: failure.key },
				"index storage cleanup failed; file orphaned",
			);
		}
	}

	await emit("indexes", indexId, "update");
}
