import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { SampleCreateRequest, SampleUpdateRequest } from "@virtool/contracts";
import {
	checkSampleRight,
	createSample,
	deleteSample,
	findSamples,
	getSample,
	getSampleOwnerId,
	resolveSampleActor,
	SampleFileDuplicateError,
	SampleGroupNotFoundError,
	SampleGroupRequiredError,
	SampleLabelsNotFoundError,
	SampleNameConflictError,
	SampleNotFoundError,
	type SampleRight,
	SampleSubtractionsNotFoundError,
	updateSample,
	updateSampleRights,
} from "@virtool/data/samples/data";
import {
	UploadNotFoundError,
	UploadReservedError,
} from "@virtool/data/uploads/data";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated, permission } from "../auth/policy";
import { db, storage } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const sampleIdSchema = z.object({
	sampleId: rowIdSchema,
});

const findSamplesSchema = z.object({
	page: pageSchema,
	perPage: perPageSchema,
	term: z.string().default(""),
	labels: z.array(rowIdSchema).default([]),
	workflows: z.array(z.string()).default([]),
	users: z.array(rowIdSchema).default([]),
});

// The group id (or legacy string), or null when none applies. `""` and `"none"`
// mean "no group", matching the Python request validator.
const groupSchema = z.union([z.number().int(), z.string(), z.null()]);

const updateSampleSchema = sampleIdSchema.extend(SampleUpdateRequest.shape);

const updateRightsSchema = sampleIdSchema.extend({
	allRead: z.boolean().optional(),
	allWrite: z.boolean().optional(),
	group: groupSchema.optional(),
	groupRead: z.boolean().optional(),
	groupWrite: z.boolean().optional(),
});

// Job states from which a sample may be deleted: the terminal states, where the
// creation job is finished and will not resume.
const DELETABLE_JOB_STATES = new Set(["cancelled", "failed", "succeeded"]);

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// ./data imports it references — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof SampleNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Sample not found.", 404);
	}
	if (err instanceof SampleNameConflictError) {
		setResponseStatus(400);
		throw new ClientError("Sample name is already in use.", 400);
	}
	if (
		err instanceof SampleLabelsNotFoundError ||
		err instanceof SampleSubtractionsNotFoundError ||
		err instanceof SampleGroupNotFoundError ||
		err instanceof SampleGroupRequiredError ||
		err instanceof SampleFileDuplicateError
	) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	if (err instanceof UploadNotFoundError) {
		setResponseStatus(400);
		throw new ClientError("File does not exist.", 400);
	}
	if (err instanceof UploadReservedError) {
		setResponseStatus(400);
		throw new ClientError("File is already reserved.", 400);
	}
	throw err;
});

// The `authenticated()` floor guarantees a signed-in caller; this enforces the
// per-sample right the operation needs on top of it. A lookup for a nonexistent
// sample returns "allowed", so the subsequent fetch surfaces the 404 rather than
// a misleading 403.
const authorizeSample = createServerOnlyFn(
	async (
		sampleId: number,
		userId: number,
		right: SampleRight,
	): Promise<void> => {
		const actor = await resolveSampleActor(db, userId);

		if (!(await checkSampleRight(db, sampleId, actor, right))) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}
	},
);

function coerceGroup(group: string | number | null | undefined): number | null {
	if (group == null || group === "" || group === "none") {
		return null;
	}
	return typeof group === "number" ? group : Number(group);
}

export const findSamplesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findSamplesSchema)
	.handler(async ({ context, data }) => {
		const actor = await resolveSampleActor(db, context.session.userId);

		return findSamples(
			db,
			{
				page: data.page,
				perPage: data.perPage,
				term: data.term,
				labels: data.labels,
				users: data.users,
				workflows: data.workflows,
			},
			actor,
		);
	});

export const getSampleFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(sampleIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeSample(data.sampleId, context.session.userId, "read");
			return await getSample(db, data.sampleId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createSampleFn = createServerFn({ method: "POST" })
	.middleware([permission("create_sample")])
	.validator(SampleCreateRequest)
	.handler(async ({ context, data }) => {
		try {
			const sample = await createSample(db, {
				name: data.name,
				host: data.host,
				isolate: data.isolate,
				locale: data.locale,
				notes: data.notes,
				libraryType: data.libraryType,
				group: coerceGroup(data.group),
				subtractions: data.subtractions,
				labels: data.labels,
				files: data.files,
				userId: context.session.userId,
			});
			setResponseStatus(201);
			return sample;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateSampleFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateSampleSchema)
	.handler(async ({ context, data }) => {
		const { sampleId, ...values } = data;
		try {
			await authorizeSample(sampleId, context.session.userId, "write");
			return await updateSample(db, sampleId, values);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteSampleFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(sampleIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeSample(data.sampleId, context.session.userId, "write");

			const sample = await getSample(db, data.sampleId);

			// A sample whose creation job is still running cannot be deleted.
			if (!sample.ready) {
				if (!sample.job) {
					setResponseStatus(400);
					throw new ClientError(
						"Unfinalized samples without jobs cannot be deleted.",
						400,
					);
				}
				if (!DELETABLE_JOB_STATES.has(sample.job.state)) {
					setResponseStatus(400);
					throw new ClientError(
						`Cannot delete sample with active job (current state: ${sample.job.state}).`,
						400,
					);
				}
			}

			await deleteSample(db, storage, logger, data.sampleId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateSampleRightsFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateRightsSchema)
	.handler(async ({ context, data }) => {
		const { sampleId, ...values } = data;

		// Rights mutation is gated more tightly than read/write: only the owner or
		// a full administrator may change them. A missing sample is a 404, not a
		// 403 — the owner lookup returns null for both.
		const ownerId = await getSampleOwnerId(db, sampleId);

		if (ownerId === null) {
			setResponseStatus(404);
			throw new ClientError("Sample not found.", 404);
		}

		const actor = await resolveSampleActor(db, context.session.userId);

		// Only the owner or a full administrator may change a sample's rights.
		if (!actor.isAdmin && actor.userId !== ownerId) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}

		try {
			return await updateSampleRights(db, sampleId, values);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
