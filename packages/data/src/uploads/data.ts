import type {
	SortDirection,
	Upload,
	UploadSearchResult,
	UploadSortField,
	UploadType,
	UserNested,
} from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { mintRootStorageKey, StorageKeyNotFoundError } from "@virtool/storage";
import { and, asc, count, desc, eq, inArray, lt, notExists } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { sampleReads, sampleUploads } from "../db/schema/samples";
import { type UploadRow, uploads as uploadsTable } from "../db/schema/uploads";
import { users as usersTable } from "../db/schema/users";
import { nowUtc, secondsAgo } from "../db/time";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/**
 * How old a reserved upload must be before the sweep may reap it.
 */
export const ORPHAN_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Fields needed to create an upload; `body` streams straight to storage. */
export type UploadCreateValues = {
	name: string;
	type: UploadType;
	userId: number;
	body: AsyncIterable<Uint8Array>;
	/**
	 * Aborted when the client cancels the request. A disconnect can surface as a
	 * clean end of `body` rather than an error, so this is checked after the
	 * write to keep a truncated file from being recorded as ready.
	 */
	signal?: AbortSignal;
};

/** Thrown when a requested upload does not exist or is already removed. */
export class UploadNotFoundError extends AppError {}

/** Thrown when a reserved upload is deleted while still in use. */
export class UploadReservedError extends AppError {}

/**
 * Thrown when a chunked upload is finalized before its bytes reached storage.
 *
 * The client commits the block list directly to storage and then asks the
 * server to finalize; if no object is there, the commit never happened and the
 * row stays unfinished rather than being marked ready over nothing.
 */
export class UploadIncompleteError extends AppError {}

/**
 * Thrown when a finalized chunked upload's storage object is not the size the
 * client declared at init.
 *
 * The declared size is locked on the row before any bytes are staged, so a
 * client that commits an empty or partial block list finalizes an object whose
 * size differs from it and is rejected rather than recorded as ready over a
 * truncated file. The row is left unfinished; the client cancels it.
 */
export class UploadSizeMismatchError extends AppError {}

function toUpload(row: UploadRow, user: UserNested | null): Upload {
	return {
		id: row.id,
		// Passed through, never defaulted. These columns are nullable, and an epoch
		// date substituted for a missing one renders as a real instant in 1970
		// rather than as the absence it is — `RelativeTime` renders null as nothing.
		createdAt: row.createdAt,
		name: row.name ?? "",
		ready: row.ready,
		removed: row.removed,
		removedAt: row.removedAt,
		reserved: row.reserved,
		size: row.size ?? 0,
		type: row.type ?? "",
		uploadedAt: row.uploadedAt,
		user,
	};
}

async function fetchUser(
	db: DbOrTx,
	userId: number,
): Promise<UserNested | null> {
	const [row] = await db
		.select({ id: usersTable.id, handle: usersTable.handle })
		.from(usersTable)
		.where(eq(usersTable.id, userId));

	return row ?? null;
}

/** Which column an upload list is ordered by, and in which direction. */
export type UploadSort = {
	direction: SortDirection;
	field: UploadSortField;
};

const SORT_COLUMNS = {
	createdAt: uploadsTable.createdAt,
	name: uploadsTable.name,
	size: uploadsTable.size,
	user: usersTable.handle,
} as const;

/**
 * The `ORDER BY` an upload list takes, defaulting to newest first.
 *
 * Every sortable column has ties — two files of the same size, two uploads made
 * in the same second — and offset pagination over a tied ordering can repeat or
 * skip rows between pages. The primary key breaks them, so the order is total.
 */
function buildOrderBy(sort: UploadSort | undefined) {
	const order = sort?.direction === "ascending" ? asc : desc;
	const column = sort ? SORT_COLUMNS[sort.field] : uploadsTable.createdAt;

	return [order(column), order(uploadsTable.id)];
}

export async function findUploads(
	db: DbOrTx,
	uploadType: UploadType | undefined,
	page: number,
	perPage: number,
	userId?: number,
	sort?: UploadSort,
): Promise<UploadSearchResult> {
	// A visible upload is finished, not deleted, and not held for a sample that
	// is mid-creation.
	const baseFilters = [
		eq(uploadsTable.ready, true),
		eq(uploadsTable.removed, false),
		eq(uploadsTable.reserved, false),
	];

	const filters = [...baseFilters];
	if (userId !== undefined) {
		filters.push(eq(uploadsTable.userId, userId));
	}
	if (uploadType) {
		filters.push(eq(uploadsTable.type, uploadType));
	}

	const skip = page > 1 ? (page - 1) * perPage : 0;

	const [[foundRow], [totalRow], rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(uploadsTable)
			.where(and(...filters)),
		db
			.select({ value: count() })
			.from(uploadsTable)
			.where(and(...baseFilters)),
		db
			.select({
				upload: uploadsTable,
				user: { id: usersTable.id, handle: usersTable.handle },
			})
			.from(uploadsTable)
			.leftJoin(usersTable, eq(usersTable.id, uploadsTable.userId))
			.where(and(...filters))
			.orderBy(...buildOrderBy(sort))
			.limit(perPage)
			.offset(skip),
	]);

	const foundCount = foundRow?.value ?? 0;

	return {
		items: rows.map((row) =>
			toUpload(row.upload, row.user?.id != null ? row.user : null),
		),
		foundCount,
		totalCount: totalRow?.value ?? 0,
		page,
		pageCount: perPage > 0 ? Math.ceil(foundCount / perPage) : 0,
		perPage,
	};
}

export async function createUpload(
	db: DbOrTx,
	storage: StorageBackend,
	values: UploadCreateValues,
): Promise<Upload> {
	const now = new Date();
	const nameOnDisk = `${crypto.randomUUID()}-${values.name}`;

	// Minted before the write, so the bytes land under a key the row then records
	// verbatim. `name_on_disk` no longer locates anything.
	const storageKey = mintRootStorageKey("uploads");

	const size = await storage.write(storageKey, values.body);

	// A cancelled upload can end the body stream cleanly, so the write resolves
	// with a truncated byte count instead of throwing. Bail before the insert so
	// no ready row ever points at a partial file; the written object is left to
	// the orphan sweep.
	values.signal?.throwIfAborted();

	const row = takeFirstOrThrow(
		await db
			.insert(uploadsTable)
			.values({
				createdAt: now,
				name: values.name,
				nameOnDisk,
				ready: true,
				removed: false,
				reserved: false,
				size,
				storageKey,
				type: values.type,
				uploadedAt: now,
				userId: values.userId,
			})
			.returning(),
	);

	await emit("uploads", row.id, "create");

	return toUpload(row, await fetchUser(db, row.userId));
}

/** Fields needed to reserve a chunked upload before its bytes exist. */
export type PendingUploadValues = {
	name: string;
	type: UploadType;
	userId: number;
	/**
	 * The file's byte length as the client reports it at init. Recorded on the
	 * row and checked against the storage object at finalize, so the size the
	 * upload commits to cannot be moved after the bytes are staged.
	 */
	expectedSize: number;
};

/** A reserved chunked upload and the storage key its bytes belong at. */
export type PendingUpload = {
	upload: Upload;
	storageKey: string;
};

/**
 * Reserve a chunked upload, minting the storage key its bytes will land at.
 *
 * Unlike {@link createUpload}, no bytes flow through this server: the client
 * writes them straight to storage under {@link PendingUpload.storageKey} and
 * calls {@link finalizePendingUpload} afterwards. The row is written `ready:
 * false`, so no list shows it and no frame is emitted until it is finalized.
 *
 * The key is recorded on the row so finalize can locate the bytes and confirm
 * they arrived. The row is also what a later finalize checks ownership against,
 * which is why the reservation is persisted rather than the key just handed out.
 */
export async function createPendingUpload(
	db: DbOrTx,
	values: PendingUploadValues,
): Promise<PendingUpload> {
	const now = new Date();
	const nameOnDisk = `${crypto.randomUUID()}-${values.name}`;
	const storageKey = mintRootStorageKey("uploads");

	const row = takeFirstOrThrow(
		await db
			.insert(uploadsTable)
			.values({
				createdAt: now,
				expectedSize: values.expectedSize,
				name: values.name,
				nameOnDisk,
				ready: false,
				removed: false,
				reserved: false,
				storageKey,
				type: values.type,
				userId: values.userId,
			})
			.returning(),
	);

	return {
		upload: toUpload(row, await fetchUser(db, row.userId)),
		storageKey,
	};
}

/**
 * Finalize a chunked upload once its bytes are committed to storage.
 *
 * The row must belong to `userId` and still be unfinished; a mismatch reads as
 * {@link UploadNotFoundError}, so one user cannot finalize another's upload or
 * probe which ids exist. The recorded size comes from storage, never the
 * client, and a missing object means the block list was never committed —
 * {@link UploadIncompleteError} — leaving the row unfinished for a retry.
 *
 * The storage object's size must equal the size the client declared at init and
 * this row recorded; an empty or partial block list commits a smaller object
 * and is rejected with {@link UploadSizeMismatchError} rather than recorded as
 * ready over a truncated file. The row is left unfinished for the client to
 * cancel.
 *
 * Idempotent: a row already finalized is returned unchanged, so a retried
 * finalize after a dropped response does not double-emit or re-stamp it.
 */
export async function finalizePendingUpload(
	db: DbOrTx,
	storage: StorageBackend,
	uploadId: number,
	userId: number,
): Promise<Upload> {
	const [row] = await db
		.select()
		.from(uploadsTable)
		.where(eq(uploadsTable.id, uploadId));

	if (!row || row.removed || row.userId !== userId || !row.storageKey) {
		throw new UploadNotFoundError();
	}

	if (row.ready) {
		return toUpload(row, await fetchUser(db, row.userId));
	}

	let size: number;
	try {
		size = await storage.size(row.storageKey);
	} catch (err) {
		if (err instanceof StorageKeyNotFoundError) {
			throw new UploadIncompleteError();
		}
		throw err;
	}

	// The declared size is null only on rows that never took the chunked path,
	// which never reach finalize; when present it is the contract the committed
	// object must meet.
	if (row.expectedSize !== null && size !== row.expectedSize) {
		throw new UploadSizeMismatchError();
	}

	// Conditional on the row still being unfinished so two overlapping finalizes
	// cannot both stamp it and both emit. The loser matches no row here and falls
	// through to return the winner's already-finished row unchanged.
	const [finalized] = await db
		.update(uploadsTable)
		.set({ ready: true, size, uploadedAt: new Date() })
		.where(and(eq(uploadsTable.id, uploadId), eq(uploadsTable.ready, false)))
		.returning();

	if (finalized === undefined) {
		const [current] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, uploadId));

		if (!current) {
			throw new UploadNotFoundError();
		}

		return toUpload(current, await fetchUser(db, current.userId));
	}

	await emit("uploads", finalized.id, "create");

	return toUpload(finalized, await fetchUser(db, finalized.userId));
}

/**
 * Cancel a chunked upload that was reserved but never finalized.
 *
 * Only the owner's own unfinished reservation is cancellable; anything else —
 * another user's row, a finalized upload, an already-removed one — reads as
 * {@link UploadNotFoundError}. The row is soft-deleted and its object dropped.
 * No frame is emitted, since an unfinished upload was never in any list.
 */
export async function cancelPendingUpload(
	db: DbOrTx,
	storage: StorageBackend,
	logger: Logger,
	uploadId: number,
	userId: number,
): Promise<void> {
	const [row] = await db
		.select()
		.from(uploadsTable)
		.where(eq(uploadsTable.id, uploadId));

	if (!row || row.removed || row.userId !== userId || row.ready) {
		throw new UploadNotFoundError();
	}

	await db
		.update(uploadsTable)
		.set({ removed: true, removedAt: new Date() })
		.where(eq(uploadsTable.id, uploadId));

	if (row.storageKey) {
		await storage.delete(row.storageKey);
	} else {
		logger.warn({ uploadId }, "cancelled upload has no storage_key to delete");
	}
}

/**
 * Delete chunked uploads reserved long ago that were never finalized.
 *
 * A reservation whose client never committed its block list, or never called
 * finalize, leaves an unfinished row that no list shows. The cutoff is far
 * longer than any real upload takes, so an in-flight upload is never swept.
 * Azure expires uncommitted blocks on its own after a week; this clears the row
 * and any object a stalled commit did land.
 */
export async function reapStalePendingUploads(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	olderThanSeconds: number,
	signal?: AbortSignal,
): Promise<ReapResult> {
	const stale = await db
		.select({ id: uploadsTable.id })
		.from(uploadsTable)
		.where(
			and(
				eq(uploadsTable.ready, false),
				eq(uploadsTable.removed, false),
				lt(uploadsTable.createdAt, secondsAgo(olderThanSeconds)),
			),
		)
		.orderBy(asc(uploadsTable.id));

	const found = stale.length;

	if (found === 0) {
		return { found, deleted: 0 };
	}

	let deleted = 0;

	for (const upload of stale) {
		signal?.throwIfAborted();

		const [reaped] = await db
			.update(uploadsTable)
			.set({ removed: true, removedAt: nowUtc() })
			.where(
				and(eq(uploadsTable.id, upload.id), eq(uploadsTable.removed, false)),
			)
			.returning({ storageKey: uploadsTable.storageKey });

		if (reaped === undefined) {
			continue;
		}

		deleted += 1;

		if (reaped.storageKey) {
			try {
				await storage.delete(reaped.storageKey);
			} catch (err) {
				logger.warn(
					{ err, uploadId: upload.id, storageKey: reaped.storageKey },
					"failed to delete stale upload object; object orphaned",
				);
			}
		}
	}

	return { found, deleted };
}

/** The storage key of an upload's bytes, with the name to download them as. */
export type UploadFile = {
	key: string;
	name: string;
};

/**
 * Resolve an upload to the storage key holding its bytes and the name it was
 * uploaded under, or `null` if there is nothing to download.
 *
 * `storage_key` locates the object and `name` is what the user chose and what
 * the download is named. Both columns are nullable at the database level, so a
 * row missing either has no downloadable file.
 */
export async function getUploadFile(
	db: DbOrTx,
	uploadId: number,
): Promise<UploadFile | null> {
	const [row] = await db
		.select({ name: uploadsTable.name, storageKey: uploadsTable.storageKey })
		.from(uploadsTable)
		.where(and(eq(uploadsTable.id, uploadId), eq(uploadsTable.removed, false)))
		.limit(1);

	if (!row?.name || !row.storageKey) {
		return null;
	}

	return { key: row.storageKey, name: row.name };
}

/**
 * The same, resolved from `name_on_disk` rather than the row's primary key.
 *
 * `createReference` puts `name_on_disk` on an `import_reference` task's context
 * instead of the upload's id, so that string is the only handle the task has.
 * The column is unique, which makes the lookup exact.
 *
 * Nothing else should reach for this: `name_on_disk` does not locate an object
 * and is kept only because that task context is spelled in terms of it.
 */
export async function getUploadFileByNameOnDisk(
	db: DbOrTx,
	nameOnDisk: string,
): Promise<UploadFile | null> {
	const [row] = await db
		.select({ name: uploadsTable.name, storageKey: uploadsTable.storageKey })
		.from(uploadsTable)
		.where(
			and(
				eq(uploadsTable.nameOnDisk, nameOnDisk),
				eq(uploadsTable.removed, false),
			),
		)
		.limit(1);

	if (!row?.name || !row.storageKey) {
		return null;
	}

	return { key: row.storageKey, name: row.name };
}

/**
 * Reserve the given uploads so they cannot be used for another sample.
 *
 * Only a visible reads upload is a valid sample input, so every id must resolve
 * to a `reads` upload that is `ready` and not `removed`; any id that does not —
 * a `reference`/`subtraction` upload, an unfinished one, or a removed one — is
 * rejected with {@link UploadNotFoundError}, exactly as a missing id is. This
 * runs before any reservation, so a bad batch reserves none.
 *
 * If one is already reserved a {@link UploadReservedError} is thrown. The final
 * update is conditional on `reserved = false` and its row count checked, so a
 * request that loses a race to reserve one of these uploads fails rather than
 * double-reserving. Takes `DbOrTx` to run inside the caller's transaction; the
 * caller commits.
 */
export async function reserveUploads(
	db: DbOrTx,
	uploadIds: number[],
): Promise<void> {
	const ids = [...new Set(uploadIds)];

	if (ids.length === 0) {
		return;
	}

	const existing = await db
		.select({ id: uploadsTable.id, reserved: uploadsTable.reserved })
		.from(uploadsTable)
		.where(
			and(
				inArray(uploadsTable.id, ids),
				eq(uploadsTable.type, "reads"),
				eq(uploadsTable.ready, true),
				eq(uploadsTable.removed, false),
			),
		);

	if (existing.length !== ids.length) {
		throw new UploadNotFoundError();
	}

	if (existing.some((row) => row.reserved)) {
		throw new UploadReservedError();
	}

	const reserved = await db
		.update(uploadsTable)
		.set({ reserved: true })
		.where(and(inArray(uploadsTable.id, ids), eq(uploadsTable.reserved, false)))
		.returning({ id: uploadsTable.id });

	if (reserved.length !== ids.length) {
		throw new UploadReservedError();
	}
}

export async function deleteUpload(
	db: DbOrTx,
	storage: StorageBackend,
	logger: Logger,
	uploadId: number,
): Promise<void> {
	const [row] = await db
		.select()
		.from(uploadsTable)
		.where(eq(uploadsTable.id, uploadId));

	if (!row || row.removed) {
		throw new UploadNotFoundError();
	}

	if (row.reserved) {
		throw new UploadReservedError();
	}

	await db
		.update(uploadsTable)
		.set({ removed: true, removedAt: new Date() })
		.where(eq(uploadsTable.id, uploadId));

	// `storage_key` is nullable at the database level. A row that lacks one names
	// no object we can locate — it predates keys being recorded — so leave its
	// bytes to the orphan sweep rather than guessing at a key.
	if (row.storageKey) {
		await storage.delete(row.storageKey);
	} else {
		logger.warn({ uploadId }, "removed upload has no storage_key to delete");
	}

	await emit("uploads", uploadId, "delete");
}

/** What one sweep of {@link reapOrphanedUploads} selected and what it removed. */
export type ReapResult = {
	/** Orphans the predicate selected. */
	found: number;
	/** Orphans this run flipped to `removed`. */
	deleted: number;
};

/**
 * Delete reserved uploads that no sample claims.
 *
 * The row goes before the object, unlike cache eviction: this is a soft delete,
 * so a refused delete leaves a row that still names the bytes. It emits no
 * frame, where `deleteUpload` does — every row it touches is `reserved`, which
 * `findUploads` filters out, so no client list held one.
 */
export async function reapOrphanedUploads(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	olderThanSeconds: number,
	onProgress?: (percent: number) => Promise<void>,
	signal?: AbortSignal,
): Promise<ReapResult> {
	/* The cutoff is Postgres's clock, not a bound `Date`, so the sweep selects
	   against the same instant it stamps `removed_at` with. A NULL `created_at`
	   is never selected. */
	const orphans = await db
		.select({ id: uploadsTable.id })
		.from(uploadsTable)
		.where(
			and(
				eq(uploadsTable.reserved, true),
				eq(uploadsTable.removed, false),
				lt(uploadsTable.createdAt, secondsAgo(olderThanSeconds)),
				notExists(
					db
						.select({ id: sampleReads.id })
						.from(sampleReads)
						.where(eq(sampleReads.upload, uploadsTable.id)),
				),
				/* `sample_reads` alone is not enough: those rows are written at
				   finalize, so a sample that is still running looks exactly like an
				   abandoned creation and has its inputs reaped out from under the
				   workflow. The cutoff cannot rescue it — it measures the age of the
				   upload rather than of the reservation, so an upload that sat in a
				   user's list for a month is reapable the moment it is reserved.

				   A `sample_uploads` row means a live sample claims the upload:
				   `createSample` writes it in the transaction that reserves, and
				   `deleteSample` clears it in the transaction that releases. What is
				   left — a reservation no sample row names — is what this sweep is
				   for. */
				notExists(
					db
						.select({ id: sampleUploads.id })
						.from(sampleUploads)
						.where(eq(sampleUploads.upload_id, uploadsTable.id)),
				),
			),
		)
		.orderBy(asc(uploadsTable.id));

	const found = orphans.length;

	if (found === 0) {
		return { found, deleted: 0 };
	}

	let deleted = 0;

	for (const [index, orphan] of orphans.entries()) {
		signal?.throwIfAborted();

		/* Release and soft-delete in one statement. Never split these: releasing
		   the batch and then looping an ordinary delete means anything
		   interrupting that loop leaves the rest `reserved = false, removed =
		   false` — which no later sweep matches, its predicate being
		   `reserved = true`, and which no list shows. The guard is also what makes
		   a reclaimed run a no-op against a sweep that committed. */
		const [reaped] = await db
			.update(uploadsTable)
			.set({ reserved: false, removed: true, removedAt: nowUtc() })
			.where(
				and(eq(uploadsTable.id, orphan.id), eq(uploadsTable.removed, false)),
			)
			.returning({ storageKey: uploadsTable.storageKey });

		// Removed by another writer since the select, so its object is that
		// writer's to delete.
		if (reaped === undefined) {
			await onProgress?.(((index + 1) / found) * 100);
			continue;
		}

		deleted += 1;

		if (reaped.storageKey) {
			try {
				await storage.delete(reaped.storageKey);
			} catch (err) {
				logger.warn(
					{ err, uploadId: orphan.id, storageKey: reaped.storageKey },
					"failed to delete reaped upload object; object orphaned",
				);
			}
		} else {
			// Predates keys being recorded, as in `deleteUpload`. A composed key
			// could reach another row's bytes.
			logger.warn(
				{ uploadId: orphan.id },
				"reaped upload has no storage_key to delete",
			);
		}

		await onProgress?.(((index + 1) / found) * 100);
	}

	return { found, deleted };
}
