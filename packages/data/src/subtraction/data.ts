import {
	computeJobProgress,
	type JobWorkflow,
	type NucleotideComposition,
	type Subtraction,
	type SubtractionFile,
	type SubtractionFileType,
	type SubtractionJobMinimal,
	type SubtractionMinimal,
	type SubtractionNested,
	type SubtractionSearchResult,
	type SubtractionUpload,
} from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { deleteKeys } from "@virtool/storage";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { jobs } from "../db/schema/jobs";
import { legacySampleSubtractions } from "../db/schema/samples";
import { subtractionFiles, subtractions } from "../db/schema/subtractions";
import { uploads } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** Fields accepted when creating a subtraction. */
export type CreateSubtractionValues = {
	name: string;
	nickname: string;
	uploadId: number;
	userId: number;
};

/** Filters and pagination accepted by {@link findSubtractions}. */
export type FindSubtractionsOptions = {
	page: number;
	perPage: number;
	term: string;
	ready: boolean;
};

/** A file a create_subtraction job wrote, as {@link finalizeSubtraction} records it. */
export type SubtractionFileValues = {
	name: string;
	type: SubtractionFileType;

	/** The byte count the caller read back from storage, never a declared one. */
	size: number;

	/** The complete key the workflow wrote to, recorded verbatim. */
	storageKey: string;
};

/**
 * The upload a subtraction was created from, as {@link getSubtractionUpload}
 * resolves it.
 *
 * Every field but the id mirrors a nullable column. A row without a
 * `storageKey` names no retrievable object, and nothing recomposes one.
 */
export type SubtractionUploadFile = {
	id: number;
	name: string | null;
	size: number | null;
	storageKey: string | null;
};

/** Fields a create_subtraction job supplies when it finishes. */
export type FinalizeSubtractionValues = {
	count: number;
	gc: NucleotideComposition;
	files: SubtractionFileValues[];
};

/** Thrown when a requested subtraction does not exist or is deleted. */
export class SubtractionNotFoundError extends AppError {}

/** Thrown when a subtraction has already been finalized. */
export class SubtractionAlreadyFinalizedError extends AppError {}

/**
 * Thrown when a job tries to finalize a subtraction that is not the one it
 * produced.
 */
export class SubtractionNotOwnedError extends AppError {}

/** Thrown when the upload a subtraction is created from does not exist. */
export class SubtractionUploadNotFoundError extends AppError {}

// The Python endpoint escapes LIKE wildcards in the search term so a user's `%`
// or `_` matches literally rather than acting as a pattern.
function escapeLike(term: string): string {
	return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const jobUser = alias(users, "job_user");

// A subtraction row joined to its owning user, its create job, and that job's
// user — the shape every read maps into a `SubtractionMinimal`.
//
// `sampleCount` is a correlated subquery rather than a join: a join to the
// sample link table would multiply the row out and force every other column
// into a `group by`. `::int` because `count(*)` is a bigint, which arrives as a
// string.
function selectSubtractionsWithResources(db: DbOrTx) {
	return db
		.select({
			id: subtractions.id,
			name: subtractions.name,
			count: subtractions.count,
			created_at: subtractions.created_at,
			nickname: subtractions.nickname,
			ready: subtractions.ready,
			gc: subtractions.gc,
			sampleCount: sql<number>`(
				select count(*)::int from ${legacySampleSubtractions}
				where ${legacySampleSubtractions.subtraction_id} = ${subtractions.id}
			)`,
			uploadId: uploads.id,
			uploadName: uploads.name,
			userId: users.id,
			userHandle: users.handle,
			jobId: jobs.id,
			jobCreatedAt: jobs.created_at,
			jobState: jobs.state,
			jobSteps: jobs.steps,
			jobWorkflow: jobs.workflow,
			jobUserId: jobUser.id,
			jobUserHandle: jobUser.handle,
		})
		.from(subtractions)
		.leftJoin(uploads, eq(subtractions.upload_id, uploads.id))
		.leftJoin(users, eq(subtractions.user_id, users.id))
		.leftJoin(jobs, eq(subtractions.job_id, jobs.id))
		.leftJoin(jobUser, eq(jobs.user_id, jobUser.id));
}

type SubtractionResourceRow = Awaited<
	ReturnType<typeof selectSubtractionsWithResources>
>[number];

function toMinimal(row: SubtractionResourceRow): SubtractionMinimal {
	const file: SubtractionUpload | null =
		row.uploadId == null
			? null
			: { id: row.uploadId, name: row.uploadName ?? "" };

	const job: SubtractionJobMinimal | null =
		row.jobId == null
			? null
			: {
					id: row.jobId,
					createdAt: row.jobCreatedAt ?? new Date(),
					progress: computeJobProgress(row.jobState, row.jobSteps),
					state: row.jobState ?? "pending",
					user:
						row.jobUserId == null
							? null
							: { id: row.jobUserId, handle: row.jobUserHandle ?? "" },
					// `jobs.workflow` carries no constraint, so it arrives as free
					// text; Python only ever writes the union members here.
					workflow: (row.jobWorkflow ?? "create_subtraction") as JobWorkflow,
				};

	return {
		id: row.id,
		name: row.name,
		count: row.count,
		createdAt: row.created_at,
		file,
		job,
		nickname: row.nickname,
		ready: row.ready,
		sampleCount: row.sampleCount,
		user:
			row.userId == null
				? null
				: { id: row.userId, handle: row.userHandle ?? "" },
	};
}

export async function findSubtractions(
	db: Db,
	{ page, perPage, term, ready }: FindSubtractionsOptions,
): Promise<SubtractionSearchResult> {
	const notDeleted = eq(subtractions.deleted, false);
	const readyFilter = eq(subtractions.ready, true);

	const findFilter = term
		? or(
				ilike(subtractions.name, `%${escapeLike(term)}%`),
				ilike(subtractions.nickname, `%${escapeLike(term)}%`),
			)
		: undefined;

	// Both the search term and the ready flag narrow the found set; the total and
	// ready counts ignore the search term, matching the Python contract.
	const foundFilter = and(
		notDeleted,
		ready ? readyFilter : undefined,
		findFilter,
	);

	const isNarrowed = Boolean(findFilter) || ready;

	const [totalCountRows, readyCountRows, foundCountRows, rows] =
		await Promise.all([
			db.select({ value: count() }).from(subtractions).where(notDeleted),
			db
				.select({ value: count() })
				.from(subtractions)
				.where(and(notDeleted, readyFilter)),
			// Without a narrowing filter the found count equals the total count, so
			// skip the redundant query and reuse totalCount below.
			isNarrowed
				? db.select({ value: count() }).from(subtractions).where(foundFilter)
				: undefined,
			selectSubtractionsWithResources(db)
				.where(foundFilter)
				.orderBy(asc(subtractions.name), asc(subtractions.id))
				.offset((page - 1) * perPage)
				.limit(perPage),
		]);

	const totalCount = takeFirstOrThrow(totalCountRows).value;
	const foundCount = foundCountRows
		? takeFirstOrThrow(foundCountRows).value
		: totalCount;

	return {
		foundCount,
		totalCount,
		readyCount: takeFirstOrThrow(readyCountRows).value,
		page,
		pageCount: foundCount ? Math.ceil(foundCount / perPage) : 0,
		perPage,
		items: rows.map(toMinimal),
	};
}

// Every non-deleted subtraction, reduced to the embedded shape. Each item
// carries its `ready` flag, so a consumer that wants only ready subtractions
// (analysis creation) filters client-side rather than the server serving a
// separate ready-only list.
export async function listSubtractionsShortlist(
	db: Db,
): Promise<SubtractionNested[]> {
	return db
		.select({
			id: subtractions.id,
			name: subtractions.name,
			ready: subtractions.ready,
		})
		.from(subtractions)
		.where(eq(subtractions.deleted, false))
		.orderBy(asc(subtractions.name), asc(subtractions.id));
}

async function getSubtractionFiles(
	db: DbOrTx,
	subtractionId: number,
): Promise<SubtractionFile[]> {
	const rows = await db
		.select()
		.from(subtractionFiles)
		.where(eq(subtractionFiles.subtraction_id, subtractionId));

	return rows.map((row) => ({
		// Served from this server by `routes/subtractions.$subtractionId.files
		// .$filename.ts`, so the client links to it directly.
		downloadUrl: `/subtractions/${subtractionId}/files/${row.name ?? ""}`,
		id: row.id,
		name: row.name ?? "",
		size: row.size ?? 0,
		storageKey: row.storage_key,
		subtraction: subtractionId,
		type: (row.type ?? "fasta") as SubtractionFileType,
	}));
}

export async function getSubtraction(
	db: DbOrTx,
	subtractionId: number,
): Promise<Subtraction> {
	const [row] = await selectSubtractionsWithResources(db).where(
		and(eq(subtractions.id, subtractionId), eq(subtractions.deleted, false)),
	);

	if (!row) {
		throw new SubtractionNotFoundError();
	}

	return {
		...toMinimal(row),
		files: await getSubtractionFiles(db, subtractionId),
		gc: row.gc,
	};
}

// Whether a live subtraction has this id. Mirrors Python's `_check_exists`.
async function checkSubtractionExists(
	db: DbOrTx,
	subtractionId: number,
): Promise<boolean> {
	const [row] = await db
		.select({ id: subtractions.id })
		.from(subtractions)
		.where(
			and(eq(subtractions.id, subtractionId), eq(subtractions.deleted, false)),
		)
		.limit(1);

	return row !== undefined;
}

/**
 * Resolve the upload a subtraction was created from.
 *
 * This is the source genome `create_subtraction` reads, and the only file a
 * subtraction has before it is finalized. It is not folded into
 * {@link getSubtraction}: that shape is served to the SPA as well, and an
 * upload's `storage_key` has no business crossing that wire.
 *
 * Returns null when the subtraction does not exist, names no upload, or names a
 * removed one. Every column here is nullable, so the fields are handed back as
 * they stand — a caller that needs the bytes checks `storageKey` itself, because
 * there is no fallback that finds the object.
 */
export async function getSubtractionUpload(
	db: DbOrTx,
	subtractionId: number,
): Promise<SubtractionUploadFile | null> {
	const [row] = await db
		.select({
			id: uploads.id,
			name: uploads.name,
			size: uploads.size,
			storageKey: uploads.storageKey,
		})
		.from(subtractions)
		.innerJoin(uploads, eq(subtractions.upload_id, uploads.id))
		.where(
			and(
				eq(subtractions.id, subtractionId),
				eq(subtractions.deleted, false),
				eq(uploads.removed, false),
			),
		)
		.limit(1);

	return row ?? null;
}

/**
 * Resolve the storage key of a subtraction file by the name it is registered
 * under.
 *
 * Returns null when the subtraction, or a file of that name on it, does not
 * exist, or when the file predates keys being recorded. The key is read off the
 * matched row rather than composed, so a filename taken from a URL names no
 * object.
 *
 * The row's `size` is deliberately not returned. It is nullable, and it records
 * what the create job wrote rather than what the bucket currently holds — a
 * caller that needs a byte count asks storage.
 */
export async function getSubtractionFileKey(
	db: DbOrTx,
	subtractionId: number,
	filename: string,
): Promise<string | null> {
	const [exists, [file]] = await Promise.all([
		checkSubtractionExists(db, subtractionId),
		db
			.select({ storageKey: subtractionFiles.storage_key })
			.from(subtractionFiles)
			.where(
				and(
					eq(subtractionFiles.subtraction_id, subtractionId),
					eq(subtractionFiles.name, filename),
				),
			)
			.limit(1),
	]);

	if (!exists) {
		return null;
	}

	return file?.storageKey ?? null;
}

export async function createSubtraction(
	db: Db,
	values: CreateSubtractionValues,
): Promise<Subtraction> {
	const newId = await db.transaction(async (tx) => {
		const upload = await tx
			.select({ id: uploads.id })
			.from(uploads)
			.where(eq(uploads.id, values.uploadId))
			.limit(1);

		if (upload.length === 0) {
			throw new SubtractionUploadNotFoundError();
		}

		const now = new Date();

		// The create_subtraction job is created in the same transaction as the
		// subtraction so a runner cannot claim it and read an empty
		// `subtraction_id` argument before the subtraction row commits.
		const job = takeFirstOrThrow(
			await tx
				.insert(jobs)
				.values({
					acquired: false,
					created_at: now,
					state: "pending",
					user_id: values.userId,
					workflow: "create_subtraction",
				})
				.returning({ id: jobs.id }),
		);

		const subtraction = takeFirstOrThrow(
			await tx
				.insert(subtractions)
				.values({
					name: values.name,
					nickname: values.nickname,
					created_at: now,
					user_id: values.userId,
					job_id: job.id,
					upload_id: values.uploadId,
				})
				.returning({ id: subtractions.id }),
		);

		return subtraction.id;
	});

	return getSubtraction(db, newId);
}

/**
 * Record what a create_subtraction job produced and flip the subtraction ready.
 *
 * The parent update is conditional on `job_id = jobId AND deleted = false AND
 * ready = false` and its row count checked, so two finalizes racing each other
 * cannot both write a file set. Losing that race — or arriving second after a
 * retry — is a {@link SubtractionAlreadyFinalizedError}; a row that is gone or
 * soft-deleted is a {@link SubtractionNotFoundError}, which is the split Python
 * makes by re-selecting `deleted` after a zero rowcount; and one produced by
 * another job — or by no job at all — is a {@link SubtractionNotOwnedError}.
 *
 * The ownership predicate rides on the `UPDATE` rather than a read before it, so
 * there is no window between the check and the write, and the fallback `SELECT`
 * answers in the order gone, then not yours, then already done — a subtraction a
 * job does not own never reports its state.
 *
 * Every `size` is the caller's reading of storage and every `storageKey` is what
 * the workflow wrote to. Nothing here reaches object storage: the caller has
 * already established that each key names an object, so this transaction holds
 * only Postgres work.
 */
export async function finalizeSubtraction(
	db: Db,
	subtractionId: number,
	jobId: number,
	values: FinalizeSubtractionValues,
): Promise<Subtraction> {
	await db.transaction(async (tx) => {
		const updated = await tx
			.update(subtractions)
			.set({ count: values.count, gc: values.gc, ready: true })
			.where(
				and(
					eq(subtractions.id, subtractionId),
					eq(subtractions.job_id, jobId),
					eq(subtractions.deleted, false),
					eq(subtractions.ready, false),
				),
			)
			.returning({ id: subtractions.id });

		if (updated.length === 0) {
			const [row] = await tx
				.select({ deleted: subtractions.deleted, jobId: subtractions.job_id })
				.from(subtractions)
				.where(eq(subtractions.id, subtractionId))
				.limit(1);

			if (!row || row.deleted) {
				throw new SubtractionNotFoundError();
			}

			if (row.jobId !== jobId) {
				throw new SubtractionNotOwnedError();
			}

			throw new SubtractionAlreadyFinalizedError();
		}

		if (values.files.length > 0) {
			await tx.insert(subtractionFiles).values(
				values.files.map((file) => ({
					name: file.name,
					subtraction_id: subtractionId,
					type: file.type,
					size: file.size,
					storage_key: file.storageKey,
				})),
			);
		}
	});

	await emit("subtractions", subtractionId, "update");

	return getSubtraction(db, subtractionId);
}

export async function updateSubtraction(
	db: Db,
	subtractionId: number,
	values: { name?: string; nickname?: string },
): Promise<Subtraction> {
	if (Object.keys(values).length > 0) {
		await db
			.update(subtractions)
			.set(values)
			.where(
				and(
					eq(subtractions.id, subtractionId),
					eq(subtractions.deleted, false),
				),
			);
	}

	return getSubtraction(db, subtractionId);
}

export async function deleteSubtraction(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	subtractionId: number,
): Promise<void> {
	const storageKeys = await db.transaction(async (tx) => {
		// The check filters out already-deleted rows, so this doubles as the
		// existence check.
		if (!(await checkSubtractionExists(tx, subtractionId))) {
			return null;
		}

		const fileRows = await tx
			.select({ key: subtractionFiles.storage_key })
			.from(subtractionFiles)
			.where(eq(subtractionFiles.subtraction_id, subtractionId));

		// Soft delete: the row stays so historical analyses that reference it still
		// resolve. Unlink it from any samples that held it as a default subtraction.
		await tx
			.update(subtractions)
			.set({ deleted: true })
			.where(eq(subtractions.id, subtractionId));

		await tx
			.delete(legacySampleSubtractions)
			.where(eq(legacySampleSubtractions.subtraction_id, subtractionId));

		return fileRows.map(({ key }) => key).filter((key) => key !== null);
	});

	if (storageKeys === null) {
		throw new SubtractionNotFoundError();
	}

	// The database write has committed, so a storage failure only orphans bytes
	// rather than failing the delete. Log the orphans so they stay observable.
	// Only objects a file row names are removed; anything written before keys
	// were recorded is left for the orphan sweep.
	const failures = await deleteKeys(storage, storageKeys);

	for (const failure of failures) {
		logger.warn(
			{ key: failure.key, err: failure.error },
			"subtraction storage cleanup failed; file orphaned",
		);
	}
}
