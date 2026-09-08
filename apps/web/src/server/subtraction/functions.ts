import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	createSubtraction,
	deleteSubtraction,
	findSubtractions,
	getSubtraction,
	listSubtractionsShortlist,
	SubtractionNotFoundError,
	SubtractionUploadNotFoundError,
	updateSubtraction,
} from "@virtool/data/subtraction/data";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db, storage } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { pageSchema, perPageSchema, rowIdSchema } from "../validation";

const findSubtractionsSchema = z.object({
	page: pageSchema,
	perPage: perPageSchema,
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

function rethrowAsHttp(err: unknown): never {
	if (err instanceof SubtractionNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Subtraction not found.", 404);
	}
	if (err instanceof SubtractionUploadNotFoundError) {
		setResponseStatus(400);
		throw new ClientError("Upload does not exist.", 400);
	}
	throw err;
}

export const findSubtractionsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findSubtractionsSchema)
	.handler(async ({ data }) =>
		findSubtractions(db, {
			page: data.page,
			perPage: data.perPage,
			term: data.term,
			ready: false,
		}),
	);

export const listSubtractionsShortlistFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async () => listSubtractionsShortlist(db));

export const getSubtractionFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(subtractionIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getSubtraction(db, data.subtractionId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createSubtractionFn = createServerFn({ method: "POST" })
	.middleware([permission("modify_subtraction")])
	.validator(createSubtractionSchema)
	.handler(async ({ context, data }) => {
		try {
			const subtraction = await createSubtraction(db, {
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
			return await updateSubtraction(db, subtractionId, values);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteSubtractionFn = createServerFn({ method: "POST" })
	.middleware([permission("modify_subtraction")])
	.validator(subtractionIdSchema)
	.handler(async ({ data }) => {
		try {
			await deleteSubtraction(db, storage, logger, data.subtractionId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
