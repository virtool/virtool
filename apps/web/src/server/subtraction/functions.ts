import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db } from "../db/pg";
import { storage } from "../storage";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";
import {
	createSubtraction as createSubtractionImpl,
	deleteSubtraction as deleteSubtractionImpl,
	findSubtractions as findSubtractionsImpl,
	getSubtraction as getSubtractionImpl,
	listSubtractionsShortlist as listSubtractionsShortlistImpl,
	SubtractionNotFoundError,
	SubtractionUploadNotFoundError,
	updateSubtraction as updateSubtractionImpl,
} from "./data";

const findSubtractionsSchema = z.object({
	page: pageSchema,
	per_page: perPageSchema,
	term: z.string().default(""),
});

const subtractionIdSchema = z.object({
	subtractionId: rowIdSchema,
});

const createSubtractionSchema = z.object({
	name: z.string().trim().min(1),
	nickname: z.string().trim().default(""),
	uploadId: rowIdSchema,
});

const updateSubtractionSchema = subtractionIdSchema.extend({
	name: z.string().trim().min(1).optional(),
	nickname: z.string().trim().optional(),
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// error imports it references — from the client bundle. A plain top-level helper
// would pin ./data and its postgres transitive dependency in the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof SubtractionNotFoundError) {
		setResponseStatus(404);
		throw new Error("Subtraction not found.");
	}
	if (err instanceof SubtractionUploadNotFoundError) {
		setResponseStatus(400);
		throw new Error("Upload does not exist.");
	}
	throw err;
});

export const findSubtractionsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findSubtractionsSchema)
	.handler(async ({ data }) =>
		findSubtractionsImpl(db, {
			page: data.page,
			perPage: data.per_page,
			term: data.term,
			ready: false,
		}),
	);

export const listSubtractionsShortlistFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => listSubtractionsShortlistImpl(db));

export const getSubtractionFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(subtractionIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getSubtractionImpl(db, data.subtractionId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createSubtractionFn = createServerFn({ method: "POST" })
	.middleware([permission("modify_subtraction")])
	.validator(createSubtractionSchema)
	.handler(async ({ context, data }) => {
		try {
			const subtraction = await createSubtractionImpl(db, {
				name: data.name,
				nickname: data.nickname,
				uploadId: data.uploadId,
				userId: context.session.userId,
			});
			setResponseStatus(201);
			return subtraction;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateSubtractionFn = createServerFn({ method: "POST" })
	.middleware([permission("modify_subtraction")])
	.validator(updateSubtractionSchema)
	.handler(async ({ data }) => {
		const { subtractionId, ...values } = data;
		try {
			return await updateSubtractionImpl(db, subtractionId, values);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteSubtractionFn = createServerFn({ method: "POST" })
	.middleware([permission("modify_subtraction")])
	.validator(subtractionIdSchema)
	.handler(async ({ data }) => {
		try {
			await deleteSubtractionImpl(db, storage, data.subtractionId);
			setResponseStatus(204);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
