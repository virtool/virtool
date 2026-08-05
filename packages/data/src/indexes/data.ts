// Reading and building reference indexes.
//
// A port of `virtool.indexes.db`, `virtool.indexes.data`, and the index half of
// `virtool.references.data`. Python still owns the *finishing* of a build — the
// `create_index` task patches every OTU in the manifest, writes the artifact to
// object storage, and flips `ready` — so everything here stops at inserting the
// row that task claims.

import { randomUUID } from "node:crypto";
import type {
	Index,
	IndexContributor,
	IndexFile,
	IndexMinimal,
	IndexOtu,
	IndexSearchResult,
} from "@virtool/contracts";
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
import {
	ReferenceArchivedError,
	ReferenceNotFoundError,
} from "../references/data";
import { createTask } from "../tasks/data";

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
