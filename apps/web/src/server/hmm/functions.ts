import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	findHmms,
	getHmm,
	HmmInstallConflictError,
	HmmNotFoundError,
	HmmReleaseError,
} from "@virtool/data/hmm/data";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db } from "../composition";
import { rowIdSchema } from "../validation";
import { installUpdate } from "./service";

const findHmmsSchema = z.object({
	page: z.number().int().min(1).default(1),
	perPage: z.number().int().min(1).max(100).default(25),
	term: z.string().default(""),
});

const hmmIdSchema = z.object({
	hmmId: rowIdSchema,
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// error-class imports it references — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof HmmNotFoundError) {
		setResponseStatus(404);
		throw new Error("HMM not found.");
	}
	if (err instanceof HmmInstallConflictError) {
		setResponseStatus(409);
		throw new Error("Install already in progress.");
	}
	if (err instanceof HmmReleaseError) {
		setResponseStatus(502);
		throw new Error(err.message);
	}
	throw err;
});

export const findHmmsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findHmmsSchema)
	.handler(async ({ data }) => findHmms(db, data));

export const getHmmFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(hmmIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getHmm(db, data.hmmId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const installHmmFn = createServerFn({ method: "POST" })
	.middleware([permission("modify_hmm")])
	.handler(async ({ context }) => {
		try {
			const installed = await installUpdate(db, context.session.userId);
			setResponseStatus(201);
			return installed;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
