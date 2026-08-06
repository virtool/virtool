import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { AnalysisWorkflow } from "@virtool/contracts";
import {
	AnalysisNoReadyIndexError,
	AnalysisNotFoundError,
	AnalysisNotNuvsError,
	AnalysisReferenceArchivedError,
	AnalysisRelationNotFoundError,
	AnalysisRunningError,
	AnalysisSequenceNotFoundError,
	blastNuvs,
	createAnalysis,
	deleteAnalysis,
	findAnalyses,
	getAnalysis,
	getAnalysisResults,
	getAnalysisSampleRights,
} from "@virtool/data/analyses/data";
import {
	checkSampleRight,
	getSampleOwnerId,
	hasSampleRight,
	resolveSampleActor,
	type SampleRight,
} from "@virtool/data/samples/data";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated } from "../auth/policy";
import { db, storage } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const analysisIdSchema = z.object({
	analysisId: rowIdSchema,
});

const findAnalysesSchema = z.object({
	sampleId: rowIdSchema.optional(),
	userId: rowIdSchema.optional(),
	page: pageSchema,
	perPage: perPageSchema,
});

const createAnalysisSchema = z.object({
	sampleId: rowIdSchema,
	refId: rowIdSchema,
	subtractionIds: z.array(rowIdSchema).default([]),
	workflow: AnalysisWorkflow,
});

const blastSchema = analysisIdSchema.extend({
	sequenceIndex: z.number().int().nonnegative(),
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// ./data imports it references — from the client bundle.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof AnalysisNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Analysis not found.", 404);
	}
	if (err instanceof AnalysisSequenceNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Sequence not found.", 404);
	}
	if (
		err instanceof AnalysisRunningError ||
		err instanceof AnalysisNotNuvsError
	) {
		setResponseStatus(409);
		throw new ClientError(err.message, 409);
	}
	if (
		err instanceof AnalysisRelationNotFoundError ||
		err instanceof AnalysisReferenceArchivedError ||
		err instanceof AnalysisNoReadyIndexError
	) {
		setResponseStatus(409);
		throw new ClientError(err.message, 409);
	}
	// Anything else — an unresolvable index, a corrupt results blob, a missing
	// HMM annotation — is a data-integrity failure rather than a client mistake,
	// and surfaces as a 500 that reaches Sentry.
	throw err;
});

// The `authenticated()` floor guarantees a signed-in caller; an analysis's own
// visibility is entirely its parent sample's, so this resolves that sample's
// rights row and applies the same predicate the samples domain does. An analysis
// that does not exist reads as "allowed", so the subsequent fetch produces the
// 404 rather than a misleading 403.
const authorizeAnalysis = createServerOnlyFn(
	async (
		analysisId: number,
		userId: number,
		rights: SampleRight[],
	): Promise<void> => {
		const row = await getAnalysisSampleRights(db, analysisId);

		if (row === null) {
			return;
		}

		const actor = await resolveSampleActor(db, userId);

		// Every named right must hold. The two are independent — a sample can be
		// world-writable without being world-readable — so deleting, which demands
		// both, cannot be reduced to the write check alone.
		if (rights.some((right) => !hasSampleRight(row, actor, right))) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}
	},
);

export const findAnalysesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findAnalysesSchema)
	.handler(async ({ context, data }) => {
		const actor = await resolveSampleActor(db, context.session.userId);

		return findAnalyses(
			db,
			{
				page: data.page,
				perPage: data.perPage,
				sampleId: data.sampleId,
				userId: data.userId,
			},
			actor,
		);
	});

export const getAnalysisFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(analysisIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeAnalysis(data.analysisId, context.session.userId, [
				"read",
			]);
			return await getAnalysis(db, data.analysisId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getAnalysisResultsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(analysisIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeAnalysis(data.analysisId, context.session.userId, [
				"read",
			]);
			return await getAnalysisResults(db, data.analysisId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createAnalysisFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createAnalysisSchema)
	.handler(async ({ context, data }) => {
		try {
			// A missing sample is a 404, not a 403 — the owner lookup distinguishes
			// the two, where the rights check alone could not.
			if ((await getSampleOwnerId(db, data.sampleId)) === null) {
				setResponseStatus(404);
				throw new ClientError("Sample not found.", 404);
			}

			// Starting an analysis writes to the sample, so it takes the write right.
			const actor = await resolveSampleActor(db, context.session.userId);

			if (!(await checkSampleRight(db, data.sampleId, actor, "write"))) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}

			const analysis = await createAnalysis(db, {
				sampleId: data.sampleId,
				referenceId: data.refId,
				subtractionIds: data.subtractionIds,
				workflow: data.workflow,
				userId: context.session.userId,
			});

			setResponseStatus(201);

			return analysis;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteAnalysisFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(analysisIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeAnalysis(data.analysisId, context.session.userId, [
				"read",
				"write",
			]);
			await deleteAnalysis(db, storage, logger, data.analysisId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const blastNuvsFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(blastSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeAnalysis(data.analysisId, context.session.userId, [
				"write",
			]);

			const blast = await blastNuvs(db, data.analysisId, data.sequenceIndex);

			setResponseStatus(201);

			return blast;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
