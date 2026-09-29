import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	SORT_DIRECTIONS,
	UPLOAD_SORT_FIELDS,
	UPLOAD_TYPES,
	type UploadPolicy,
} from "@virtool/contracts";
import { getSettings } from "@virtool/data/settings/data";
import { deleteUpload, findUploads } from "@virtool/data/uploads/data";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db, storage } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";
import { getUploadErrorResponse } from "./errors";
import {
	cancelUpload,
	finalizeUpload,
	initializeUpload,
	uploadInitSchema,
} from "./service";

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

function rethrowAsHttp(err: unknown): never {
	const response = getUploadErrorResponse(err);
	if (response) {
		setResponseStatus(response.status);
		throw new ClientError(response.message, response.status);
	}
	throw err;
}

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

/** Begin a direct upload for the browser client. */
export const initUploadFn = createServerFn({ method: "POST" })
	.middleware([permission("upload_file")])
	.validator(uploadInitSchema)
	.handler(async ({ data, context }) => {
		try {
			return await initializeUpload(data, context.principal.userId);
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
			return await finalizeUpload(data.id, context.principal.userId);
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
			await cancelUpload(data.id, context.principal.userId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
