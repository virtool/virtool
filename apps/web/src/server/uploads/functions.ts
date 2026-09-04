import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	AZURE_MAX_BLOB_SIZE,
	SORT_DIRECTIONS,
	UPLOAD_SORT_FIELDS,
	UPLOAD_TYPES,
	type UploadPolicy,
	UploadTooLargeError,
} from "@virtool/contracts";
import { getSettings } from "@virtool/data/settings/data";
import {
	deleteUpload,
	findUploads,
	UploadIncompleteError,
	UploadNotFoundError,
	UploadReservedError,
	UploadSizeMismatchError,
} from "@virtool/data/uploads/data";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db, storage } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";
import { cancelUpload, finalizeUpload, initializeUpload } from "./service";

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
	if (err instanceof UploadSizeMismatchError) {
		setResponseStatus(409);
		throw new ClientError("Upload size does not match the declared size.");
	}
	if (err instanceof UploadTooLargeError) {
		setResponseStatus(413);
		throw new ClientError(err.message);
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
	// The file's byte length, locked here so finalize can reject a commit that
	// does not land exactly this many bytes.
	size: z.number().int().nonnegative().max(AZURE_MAX_BLOB_SIZE),
});

/** Begin a direct upload for the browser client. */
export const initUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("upload_file")])
	.validator(initUploadSchema)
	.handler(async ({ data, context }) => {
		try {
			return await initializeUpload(data, context.session.userId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

/** Expose the upload limit to authenticated users without exposing other settings. */
export const getUploadPolicyFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async (): Promise<UploadPolicy> => {
		const { maxUploadSize } = await getSettings(db);
		return { maxUploadSize };
	});

/**
 * Finalize a chunked upload once its blocks are committed, returning the upload.
 */
export const finalizeChunkedUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("upload_file")])
	.validator(uploadIdSchema)
	.handler(async ({ data, context }) => {
		try {
			return await finalizeUpload(data.id, context.session.userId);
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
			await cancelUpload(data.id, context.session.userId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
