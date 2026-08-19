import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	SORT_DIRECTIONS,
	UPLOAD_SORT_FIELDS,
	UPLOAD_TYPES,
} from "@virtool/contracts";
import {
	deleteUpload,
	findUploads,
	UploadNotFoundError,
	UploadReservedError,
} from "@virtool/data/uploads/data";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db, storage } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

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
