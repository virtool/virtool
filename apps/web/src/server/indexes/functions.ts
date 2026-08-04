import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { emit } from "@virtool/data/events/emit";
import { findUnbuiltByReference } from "@virtool/data/history/data";
import {
	createIndex,
	findIndexes,
	getIndex,
	IndexBuildInProgressError,
	IndexNotFoundError,
	listReadyIndexes,
	NoUnbuiltChangesError,
	UnverifiedOtusError,
} from "@virtool/data/indexes/data";
import {
	checkReferenceRight,
	ReferenceArchivedError,
	ReferenceNotFoundError,
	resolveReferenceActor,
} from "@virtool/data/references/data";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const indexIdSchema = z.object({ indexId: rowIdSchema });

const referenceIdSchema = z.object({ referenceId: rowIdSchema });

const findIndexesSchema = referenceIdSchema.extend({
	page: pageSchema,
	per_page: perPageSchema,
});

const listReadyIndexesSchema = z.object({
	archived: z.boolean().optional(),
});

const findUnbuiltChangesSchema = referenceIdSchema.extend({
	page: pageSchema,
	per_page: perPageSchema,
});

// Wrapped in createServerOnlyFn so the compiler can strip these bodies — and the
// ./data imports they reference — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof IndexNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Index not found.", 404);
	}
	if (err instanceof ReferenceNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Reference not found.", 404);
	}
	if (
		err instanceof IndexBuildInProgressError ||
		err instanceof ReferenceArchivedError
	) {
		setResponseStatus(409);
		throw new ClientError(err.message, 409);
	}
	// The two "nothing to build" outcomes are 400s upstream, not conflicts, and
	// the rebuild dialog matches on the message to explain the unverified case.
	if (
		err instanceof UnverifiedOtusError ||
		err instanceof NoUnbuiltChangesError
	) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	throw err;
});

const authorizeBuild = createServerOnlyFn(
	async (referenceId: number, userId: number): Promise<void> => {
		const actor = await resolveReferenceActor(db, userId);

		if (!(await checkReferenceRight(db, referenceId, "build", actor))) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}
	},
);

export const findIndexesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findIndexesSchema)
	.handler(async ({ data }) =>
		findIndexes(db, {
			referenceId: data.referenceId,
			page: data.page,
			perPage: data.per_page,
		}),
	);

export const listReadyIndexesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(listReadyIndexesSchema)
	.handler(async ({ data }) => listReadyIndexes(db, data.archived));

export const getIndexFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(indexIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getIndex(db, data.indexId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const findUnbuiltChangesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findUnbuiltChangesSchema)
	.handler(async ({ data }) =>
		findUnbuiltByReference(db, data.referenceId, data.page, data.per_page),
	);

export const createIndexFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeBuild(data.referenceId, context.session.userId);

			const index = await createIndex(
				db,
				data.referenceId,
				context.session.userId,
			);

			// The build changes what the reference's index list holds for every
			// client, not just the one that started it.
			await emit("indexes", index.id, "create");

			setResponseStatus(201);
			return index;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
