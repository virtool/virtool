import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	IsolateCreateRequest,
	IsolateUpdateRequest,
	OtuCreateRequest,
	OtuUpdateRequest,
	SequenceCreateRequest,
	SequenceUpdateRequest,
} from "@virtool/contracts";
import { listByOtu } from "@virtool/data/history/data";
import {
	createIsolate,
	createOtu,
	createSequence,
	deleteIsolate,
	deleteOtu,
	deleteSequence,
	findOtus,
	getOtu,
	getOtuReference,
	IsolateNotFoundError,
	OtuNameConflictError,
	OtuNotFoundError,
	SegmentNotDefinedError,
	SequenceNotFoundError,
	SourceTypeNotAllowedError,
	sequenceExists,
	setIsolateAsDefault,
	updateIsolate,
	updateOtu,
	updateSequence,
} from "@virtool/data/otus/data";
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

// An OTU, isolate, or sequence id is the 8-character string Mongo's `_id` held,
// not a Postgres serial, so `rowIdSchema` does not apply.
const legacyIdSchema = z.string().min(1);

const otuIdSchema = z.object({ otuId: legacyIdSchema });

const isolateIdSchema = otuIdSchema.extend({ isolateId: legacyIdSchema });

const sequenceIdSchema = isolateIdSchema.extend({
	sequenceId: legacyIdSchema,
});

const findOtusSchema = z.object({
	referenceId: rowIdSchema,
	page: pageSchema,
	perPage: perPageSchema,
	term: z.string().default(""),
});

const createOtuSchema = z
	.object({ referenceId: rowIdSchema })
	.extend(OtuCreateRequest.shape);

const updateOtuSchema = otuIdSchema.extend(OtuUpdateRequest.shape);

const createIsolateSchema = otuIdSchema.extend(IsolateCreateRequest.shape);

const updateIsolateSchema = isolateIdSchema.extend(IsolateUpdateRequest.shape);

const createSequenceSchema = isolateIdSchema.extend(
	SequenceCreateRequest.shape,
);

const updateSequenceSchema = sequenceIdSchema.extend(
	SequenceUpdateRequest.shape,
);

// Wrapped in createServerOnlyFn so the compiler can strip these bodies — and the
// ./data imports they reference — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (
		err instanceof OtuNotFoundError ||
		err instanceof IsolateNotFoundError ||
		err instanceof SequenceNotFoundError
	) {
		setResponseStatus(404);
		throw new ClientError(err.message, 404);
	}
	if (err instanceof ReferenceNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Reference not found.", 404);
	}
	if (err instanceof ReferenceArchivedError) {
		setResponseStatus(409);
		throw new ClientError("Reference is archived.", 409);
	}
	if (
		err instanceof OtuNameConflictError ||
		err instanceof SourceTypeNotAllowedError ||
		err instanceof SegmentNotDefinedError
	) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	throw err;
});

const notFound = createServerOnlyFn((message: string): never => {
	setResponseStatus(404);
	throw new ClientError(message, 404);
});

/**
 * Resolve the OTU's parent reference and require `modify_otu` on it, returning
 * the reference id the mutation writes against.
 *
 * Naming an isolate scopes the lookup to it, so an isolate the OTU does not
 * carry surfaces as a 404 rather than passing the rights check and failing
 * later. A missing OTU is a 404 for everyone, administrators included — there is
 * no reference to hold a right on.
 *
 * An archived reference accepts no writes at all, so it is refused even from a
 * member who still holds the right. The check follows the rights check so that
 * a caller with no rights learns nothing about the reference's state. `createOtu`
 * makes the same refusal inside its own transaction, against the reference the
 * request names rather than one an OTU points at.
 */
const authorizeOtu = createServerOnlyFn(
	async (
		otuId: string,
		userId: number,
		isolateId?: string,
	): Promise<number> => {
		const reference = await getOtuReference(db, otuId, isolateId);

		if (reference === null) {
			return notFound(
				isolateId === undefined
					? "OTU not found."
					: "OTU or isolate not found.",
			);
		}

		const actor = await resolveReferenceActor(db, userId);

		if (!(await checkReferenceRight(db, reference.id, "modifyOtu", actor))) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}

		if (reference.archived) {
			throw new ReferenceArchivedError("Reference is archived");
		}

		return reference.id;
	},
);

export const findOtusFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findOtusSchema)
	.handler(async ({ data }) => {
		try {
			return await findOtus(db, data.referenceId, {
				page: data.page,
				perPage: data.perPage,
				term: data.term,
			});
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getOtuFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(otuIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getOtu(db, data.otuId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const listOtuHistoryFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(otuIdSchema)
	.handler(async ({ data }) => {
		try {
			return await listByOtu(db, data.otuId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createOtuFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createOtuSchema)
	.handler(async ({ context, data }) => {
		const { referenceId, ...values } = data;

		try {
			// The reference comes from the request rather than from an OTU that does
			// not exist yet, so the right is checked against it directly.
			const actor = await resolveReferenceActor(db, context.session.userId);

			if (!(await checkReferenceRight(db, referenceId, "modifyOtu", actor))) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}

			const otu = await createOtu(
				db,
				referenceId,
				values,
				context.session.userId,
			);

			setResponseStatus(201);

			return otu;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateOtuFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateOtuSchema)
	.handler(async ({ context, data }) => {
		const { otuId, ...values } = data;

		try {
			await authorizeOtu(otuId, context.session.userId);

			return await updateOtu(db, otuId, values, context.session.userId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteOtuFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(otuIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeOtu(data.otuId, context.session.userId);

			await deleteOtu(db, data.otuId, context.session.userId);

			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createIsolateFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createIsolateSchema)
	.handler(async ({ context, data }) => {
		const { otuId, ...values } = data;

		try {
			await authorizeOtu(otuId, context.session.userId);

			const isolate = await createIsolate(
				db,
				otuId,
				values,
				context.session.userId,
			);

			setResponseStatus(201);

			return isolate;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateIsolateFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateIsolateSchema)
	.handler(async ({ context, data }) => {
		const { otuId, isolateId, ...values } = data;

		try {
			await authorizeOtu(otuId, context.session.userId, isolateId);

			return await updateIsolate(
				db,
				otuId,
				isolateId,
				values,
				context.session.userId,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const setIsolateAsDefaultFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(isolateIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeOtu(data.otuId, context.session.userId, data.isolateId);

			return await setIsolateAsDefault(
				db,
				data.otuId,
				data.isolateId,
				context.session.userId,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteIsolateFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(isolateIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeOtu(data.otuId, context.session.userId, data.isolateId);

			await deleteIsolate(
				db,
				data.otuId,
				data.isolateId,
				context.session.userId,
			);

			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createSequenceFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createSequenceSchema)
	.handler(async ({ context, data }) => {
		const { otuId, isolateId, ...values } = data;

		try {
			await authorizeOtu(otuId, context.session.userId, isolateId);

			const sequence = await createSequence(
				db,
				otuId,
				isolateId,
				values,
				context.session.userId,
			);

			setResponseStatus(201);

			return sequence;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateSequenceFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateSequenceSchema)
	.handler(async ({ context, data }) => {
		const { otuId, isolateId, sequenceId, ...values } = data;

		try {
			// The sequence is checked before the rights are, so a caller naming a
			// sequence that does not exist gets a 404 whether or not they could have
			// edited it. Python orders it this way and the client relies on the 404.
			if (!(await sequenceExists(db, otuId, isolateId, sequenceId))) {
				return notFound("Sequence not found.");
			}

			await authorizeOtu(otuId, context.session.userId, isolateId);

			return await updateSequence(
				db,
				otuId,
				isolateId,
				sequenceId,
				values,
				context.session.userId,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteSequenceFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(sequenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			if (
				!(await sequenceExists(db, data.otuId, data.isolateId, data.sequenceId))
			) {
				return notFound("Sequence not found.");
			}

			await authorizeOtu(data.otuId, context.session.userId, data.isolateId);

			await deleteSequence(
				db,
				data.otuId,
				data.isolateId,
				data.sequenceId,
				context.session.userId,
			);

			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
