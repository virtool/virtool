import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	SORT_DIRECTIONS,
	UPLOAD_SORT_FIELDS,
	UPLOAD_TYPES,
} from "@virtool/contracts";
import {
	cancelPendingUpload,
	createPendingUpload,
	deleteUpload,
	finalizePendingUpload,
	findUploads,
	UploadIncompleteError,
	UploadNotFoundError,
	UploadReservedError,
} from "@virtool/data/uploads/data";
import { STORAGE_CHUNK_SIZE } from "@virtool/storage";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db, storage } from "../composition";
import { config } from "../config";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

// A chunked upload can run for a long time across hundreds of block writes, so
// the write SAS lives in hours where a download redirect lives in minutes.
const UPLOAD_SAS_TTL_SECONDS = 6 * 60 * 60;

// The upload endpoint itself is not a server function — it streams a multi-GB
// request body and is posted to with XMLHttpRequest so the client can report
// progress. It lives in the `/uploads` route (`@server/uploads/upload`).

const findUploadsSchema = z
	.object({
		uploadType: z.enum(UPLOAD_TYPES).optional(),
		page: pageSchema,
		perPage: perPageSchema,
		user: rowIdSchema.optional(),
		// A direction without a column has nothing to order by, so the pair is
		// taken together: no column means the default newest-first ordering.
		sort: z.enum(UPLOAD_SORT_FIELDS).optional(),
		direction: z.enum(SORT_DIRECTIONS).default("descending"),
	})
	.optional();

const uploadIdSchema = z.object({
	id: rowIdSchema,
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// UploadNotFoundError / UploadReservedError imports it references — from the
// client bundle. A plain top-level helper would pin ./data and its postgres
// transitive dependency in the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof UploadNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Upload not found.");
	}
	if (err instanceof UploadReservedError) {
		setResponseStatus(409);
		throw new ClientError("Upload is reserved and in use.");
	}
	if (err instanceof UploadIncompleteError) {
		setResponseStatus(409);
		throw new ClientError("Upload is not complete.");
	}
	throw err;
});

export const findUploadsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findUploadsSchema)
	.handler(async ({ data }) =>
		findUploads(
			db,
			data?.uploadType,
			data?.page ?? 1,
			data?.perPage ?? 25,
			data?.user,
			data?.sort ? { direction: data.direction, field: data.sort } : undefined,
		),
	);

export const deleteUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("remove_file")])
	.validator(uploadIdSchema)
	.handler(async ({ data }) => {
		try {
			await deleteUpload(db, storage, logger, data.id);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

const initUploadSchema = z.object({
	name: z.string().min(1),
	type: z.enum(UPLOAD_TYPES),
});

/**
 * Begin an upload, deciding whether it goes direct-to-blob or through this
 * server.
 *
 * The server owns the choice so the client never carries the feature flag:
 * when chunked uploads are enabled and the backend can presign, this reserves
 * the upload and returns the write SAS the client PUTs its blocks to; otherwise
 * it returns `proxied` and the client falls back to the `POST /uploads` route.
 * A `proxied` result reserves nothing — that route creates its own row.
 *
 * `blockSize` is the block size the client cuts the file into. After committing
 * the block list the client calls {@link finalizeChunkedUploadFn}.
 */
export const initUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("upload_file")])
	.validator(initUploadSchema)
	.handler(async ({ data, context }) => {
		const presignUpload = storage.presignUpload;

		if (!config.uploadsChunked || !presignUpload) {
			return { mode: "proxied" as const };
		}

		const { upload, storageKey } = await createPendingUpload(db, {
			name: data.name,
			type: data.type,
			userId: context.session.userId,
		});

		return {
			mode: "chunked" as const,
			uploadId: upload.id,
			url: await presignUpload(storageKey, {
				expiresIn: UPLOAD_SAS_TTL_SECONDS,
			}),
			blockSize: STORAGE_CHUNK_SIZE,
		};
	});

/**
 * Finalize a chunked upload once its blocks are committed, returning the upload.
 */
export const finalizeChunkedUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("upload_file")])
	.validator(uploadIdSchema)
	.handler(async ({ data, context }) => {
		try {
			return await finalizePendingUpload(
				db,
				storage,
				data.id,
				context.session.userId,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

/**
 * Cancel a chunked upload that was reserved but never finalized.
 */
export const cancelChunkedUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("upload_file")])
	.validator(uploadIdSchema)
	.handler(async ({ data, context }) => {
		try {
			await cancelPendingUpload(
				db,
				storage,
				logger,
				data.id,
				context.session.userId,
			);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
