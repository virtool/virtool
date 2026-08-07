import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	ReferenceCreateRequest,
	type ReferenceRight,
	ReferenceUpdateRequest,
} from "@virtool/contracts";
import {
	addReferenceGroup,
	addReferenceUser,
	checkReferenceRight,
	checkReferenceVisibility,
	createReference,
	findReferences,
	getReference,
	ReferenceArchivedError,
	ReferenceCloneSourceNotFoundError,
	ReferenceImportUploadNotFoundError,
	ReferenceMemberConflictError,
	ReferenceMemberNotFoundError,
	ReferenceNotFoundError,
	removeReferenceGroup,
	removeReferenceUser,
	resolveReferenceActor,
	setReferenceArchived,
	updateReference,
	updateReferenceGroup,
	updateReferenceUser,
} from "@virtool/data/references/data";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated, permission } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const referenceIdSchema = z.object({
	referenceId: rowIdSchema,
});

const findReferencesSchema = z.object({
	page: pageSchema,
	perPage: perPageSchema,
	term: z.string().default(""),
	archived: z.boolean().optional(),
});

const rightsSchema = z.object({
	build: z.boolean().optional(),
	modify: z.boolean().optional(),
	modifyOtu: z.boolean().optional(),
});

const createReferenceSchema = ReferenceCreateRequest.refine(
	(data) => !(data.cloneFrom !== undefined && data.importFrom !== undefined),
	{
		message: "Only one of cloneFrom or importFrom may be set.",
	},
);

const updateReferenceSchema = referenceIdSchema.extend(
	ReferenceUpdateRequest.shape,
);

const referenceUserSchema = referenceIdSchema.extend({
	userId: rowIdSchema,
});

const referenceGroupSchema = referenceIdSchema.extend({
	groupId: rowIdSchema,
});

const addReferenceUserSchema = referenceUserSchema.merge(rightsSchema);
const addReferenceGroupSchema = referenceGroupSchema.merge(rightsSchema);
const updateReferenceUserSchema = referenceUserSchema.merge(rightsSchema);
const updateReferenceGroupSchema = referenceGroupSchema.merge(rightsSchema);

// Wrapped in createServerOnlyFn so the compiler can strip these bodies — and the
// ./data imports they reference — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof ReferenceNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Reference not found.", 404);
	}
	if (err instanceof ReferenceArchivedError) {
		setResponseStatus(409);
		throw new ClientError("Reference is archived.", 409);
	}
	if (err instanceof ReferenceCloneSourceNotFoundError) {
		setResponseStatus(400);
		throw new ClientError("Source reference does not exist.", 400);
	}
	if (err instanceof ReferenceImportUploadNotFoundError) {
		setResponseStatus(400);
		throw new ClientError("Upload does not exist.", 400);
	}
	if (err instanceof ReferenceMemberNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Member not found.", 404);
	}
	if (err instanceof ReferenceMemberConflictError) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	throw err;
});

// The `authenticated()` floor guarantees a signed-in caller; this enforces the
// per-reference right the operation needs on top of it. A full administrator
// passes every check; a missing reference surfaces as a 404 for a
// non-administrator via `checkReferenceRight`.
const authorizeReference = createServerOnlyFn(
	async (
		referenceId: number,
		userId: number,
		right: ReferenceRight,
	): Promise<void> => {
		const actor = await resolveReferenceActor(db, userId);

		if (!(await checkReferenceRight(db, referenceId, right, actor))) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}
	},
);

export const findReferencesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findReferencesSchema)
	.handler(async ({ context, data }) => {
		const actor = await resolveReferenceActor(db, context.session.userId);

		return findReferences(
			db,
			{
				page: data.page,
				perPage: data.perPage,
				term: data.term,
				archived: data.archived,
			},
			actor,
		);
	});

export const getReferenceFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			// Detail read enforces the same visibility rule as the list: a
			// non-member, non-administrator caller cannot tell a hidden reference
			// from a missing one — both surface as a 404.
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (!(await checkReferenceVisibility(db, data.referenceId, actor))) {
				throw new ReferenceNotFoundError();
			}
			return await getReference(db, data.referenceId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createReferenceFn = createServerFn({ method: "POST" })
	.middleware([permission("create_ref")])
	.validator(createReferenceSchema)
	.handler(async ({ context, data }) => {
		try {
			const reference = await createReference(db, {
				name: data.name,
				description: data.description,
				organism: data.organism,
				cloneFrom: data.cloneFrom,
				importFrom: data.importFrom,
				userId: context.session.userId,
			});
			setResponseStatus(201);
			return reference;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateReferenceFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateReferenceSchema)
	.handler(async ({ context, data }) => {
		const { referenceId, ...values } = data;
		try {
			await authorizeReference(referenceId, context.session.userId, "modify");
			return await updateReference(db, referenceId, values);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const archiveReferenceFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReference(
				data.referenceId,
				context.session.userId,
				"modify",
			);
			return await setReferenceArchived(db, data.referenceId, true);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const unarchiveReferenceFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReference(
				data.referenceId,
				context.session.userId,
				"modify",
			);
			return await setReferenceArchived(db, data.referenceId, false);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const addReferenceUserFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(addReferenceUserSchema)
	.handler(async ({ context, data }) => {
		const { referenceId, userId, ...rights } = data;
		try {
			await authorizeReference(referenceId, context.session.userId, "modify");
			const member = await addReferenceUser(db, referenceId, userId, rights);
			setResponseStatus(201);
			return member;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const addReferenceGroupFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(addReferenceGroupSchema)
	.handler(async ({ context, data }) => {
		const { referenceId, groupId, ...rights } = data;
		try {
			// The user-membership add checks `modify`; this closes the asymmetry with
			// the Python service, which left group-add unguarded.
			await authorizeReference(referenceId, context.session.userId, "modify");
			const member = await addReferenceGroup(db, referenceId, groupId, rights);
			setResponseStatus(201);
			return member;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateReferenceUserFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateReferenceUserSchema)
	.handler(async ({ context, data }) => {
		const { referenceId, userId, ...rights } = data;
		try {
			await authorizeReference(referenceId, context.session.userId, "modify");
			return await updateReferenceUser(db, referenceId, userId, rights);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateReferenceGroupFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateReferenceGroupSchema)
	.handler(async ({ context, data }) => {
		const { referenceId, groupId, ...rights } = data;
		try {
			await authorizeReference(referenceId, context.session.userId, "modify");
			return await updateReferenceGroup(db, referenceId, groupId, rights);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const removeReferenceUserFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceUserSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReference(
				data.referenceId,
				context.session.userId,
				"modify",
			);
			await removeReferenceUser(db, data.referenceId, data.userId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const removeReferenceGroupFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceGroupSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReference(
				data.referenceId,
				context.session.userId,
				"modify",
			);
			await removeReferenceGroup(db, data.referenceId, data.groupId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
