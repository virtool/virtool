import type {
	Upload,
	UploadSearchResult,
	UploadType,
	UserNested,
} from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { mintRootStorageKey } from "@virtool/storage";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { type UploadRow, uploads as uploadsTable } from "../db/schema/uploads";
import { users as usersTable } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** Fields needed to create an upload; `body` streams straight to storage. */
export type UploadCreateValues = {
	name: string;
	type: UploadType;
	userId: number;
	body: AsyncIterable<Uint8Array>;
};

/** Thrown when a requested upload does not exist or is already removed. */
export class UploadNotFoundError extends AppError {}

/** Thrown when a reserved upload is deleted while still in use. */
export class UploadReservedError extends AppError {}

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

export async function findUploads(
	db: DbOrTx,
	uploadType: UploadType | undefined,
	page: number,
	perPage: number,
	userId?: number,
): Promise<UploadSearchResult> {
	// A visible upload is finished, not deleted, and not held for a sample that
	// is mid-creation. Python applies the same three base filters unconditionally.
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
			.orderBy(desc(uploadsTable.createdAt))
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
	// verbatim. `name_on_disk` no longer locates anything; Python still reads it
	// to identify the upload a reference-import task was queued against.
	const storageKey = mintRootStorageKey("uploads");

	const size = await storage.write(storageKey, values.body);

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
 *
 * A removed upload is excluded, matching Python. `ready` is deliberately not
 * filtered on: Python does not either, and an upload created from this side is
 * only inserted once its bytes are written.
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
