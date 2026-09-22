import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	ReferenceV2CreateRequest,
	type ReferenceV2Right,
} from "@virtool/contracts";
import { resolveReferenceActor } from "@virtool/data/references/data";
import {
	addReferenceV2Group,
	addReferenceV2User,
	checkReferenceV2Right,
	checkReferenceV2Visibility,
	createReferenceV2,
	deleteReferenceV2,
	getReferencesV2,
	getReferenceV2,
	ReferenceV2MemberConflictError,
	ReferenceV2MemberNotFoundError,
	ReferenceV2NotFoundError,
	removeReferenceV2Group,
	removeReferenceV2User,
	setReferenceV2Archived,
	updateReferenceV2Group,
	updateReferenceV2User,
} from "@virtool/data/references-v2/data";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated, permission } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";

const referenceIdSchema = z.object({
	referenceId: z.uuid(),
});

const rightsSchema = z.object({
	publishVersion: z.boolean().optional(),
	modify: z.boolean().optional(),
	modifyOtu: z.boolean().optional(),
});

const referenceUserSchema = referenceIdSchema.extend({
	userId: z.number().int().positive(),
});
const referenceGroupSchema = referenceIdSchema.extend({
	groupId: z.number().int().positive(),
});

// Wrapped in createServerOnlyFn so the compiler can strip these bodies — and the
// ./data imports they reference — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof ReferenceV2NotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Reference not found.", 404);
	}
	if (err instanceof ReferenceV2MemberNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Member not found.", 404);
	}
	if (err instanceof ReferenceV2MemberConflictError) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	throw err;
});

const authorizeReferenceV2 = createServerOnlyFn(
	async (
		referenceId: string,
		userId: number,
		right: ReferenceV2Right,
	): Promise<void> => {
		const actor = await resolveReferenceActor(db, userId);
		if (!(await checkReferenceV2Right(db, referenceId, right, actor))) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}
	},
);

export const createReferenceV2Fn = createServerFn({ method: "POST" })
	.middleware([permission("create_ref")])
	.validator(ReferenceV2CreateRequest)
	.handler(async ({ context, data }) => {
		const reference = await createReferenceV2(db, {
			name: data.name,
			description: data.description,
			defaultSegmentLengthTolerance: data.defaultSegmentLengthTolerance,
			userId: context.principal.userId,
		});
		setResponseStatus(201);
		return reference;
	});

export const getReferenceV2Fn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			// A non-member, non-administrator caller cannot tell a hidden Reference
			// from a missing one — both surface as a 404.
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getReferenceV2(db, data.referenceId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getReferencesV2Fn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }) => {
		const actor = await resolveReferenceActor(db, context.principal.userId);
		return getReferencesV2(db, actor);
	});

export const deleteReferenceV2Fn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modify", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			await deleteReferenceV2(db, data.referenceId);
			setResponseStatus(204);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const archiveReferenceV2Fn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReferenceV2(
				data.referenceId,
				context.principal.userId,
				"modify",
			);
			return await setReferenceV2Archived(db, data.referenceId, true);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const unarchiveReferenceV2Fn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReferenceV2(
				data.referenceId,
				context.principal.userId,
				"modify",
			);
			return await setReferenceV2Archived(db, data.referenceId, false);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const addReferenceV2UserFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceUserSchema.merge(rightsSchema))
	.handler(async ({ context, data }) => {
		const { referenceId, userId, ...rights } = data;
		try {
			await authorizeReferenceV2(
				referenceId,
				context.principal.userId,
				"modify",
			);
			const member = await addReferenceV2User(db, referenceId, userId, rights);
			setResponseStatus(201);
			return member;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const addReferenceV2GroupFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceGroupSchema.merge(rightsSchema))
	.handler(async ({ context, data }) => {
		const { referenceId, groupId, ...rights } = data;
		try {
			await authorizeReferenceV2(
				referenceId,
				context.principal.userId,
				"modify",
			);
			const member = await addReferenceV2Group(
				db,
				referenceId,
				groupId,
				rights,
			);
			setResponseStatus(201);
			return member;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateReferenceV2UserFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceUserSchema.merge(rightsSchema))
	.handler(async ({ context, data }) => {
		const { referenceId, userId, ...rights } = data;
		try {
			await authorizeReferenceV2(
				referenceId,
				context.principal.userId,
				"modify",
			);
			return await updateReferenceV2User(db, referenceId, userId, rights);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateReferenceV2GroupFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceGroupSchema.merge(rightsSchema))
	.handler(async ({ context, data }) => {
		const { referenceId, groupId, ...rights } = data;
		try {
			await authorizeReferenceV2(
				referenceId,
				context.principal.userId,
				"modify",
			);
			return await updateReferenceV2Group(db, referenceId, groupId, rights);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const removeReferenceV2UserFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceUserSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReferenceV2(
				data.referenceId,
				context.principal.userId,
				"modify",
			);
			await removeReferenceV2User(db, data.referenceId, data.userId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const removeReferenceV2GroupFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(referenceGroupSchema)
	.handler(async ({ context, data }) => {
		try {
			await authorizeReferenceV2(
				data.referenceId,
				context.principal.userId,
				"modify",
			);
			await removeReferenceV2Group(db, data.referenceId, data.groupId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
