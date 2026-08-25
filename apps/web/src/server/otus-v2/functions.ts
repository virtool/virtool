import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { CreateLocalOtuCommand } from "@virtool/contracts";
import {
	createLocalOtu,
	getLocalOtu,
	OtuV2ConflictError,
	OtuV2NotFoundError,
	OtuV2ReferenceNotWritableError,
} from "@virtool/data/otus-v2/data";
import { resolveReferenceActor } from "@virtool/data/references/data";
import {
	checkReferenceV2Right,
	checkReferenceV2Visibility,
	ReferenceV2NotFoundError,
} from "@virtool/data/references-v2/data";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";

const otuReadSchema = z.object({
	referenceId: z.uuid(),
	otuId: z.uuid(),
});

const createLocalOtuSchema = z.object({
	referenceId: z.uuid(),
	command: CreateLocalOtuCommand,
});

// Wrapped in createServerOnlyFn so the compiler can strip these bodies — and the
// ./data imports they reference — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (
		err instanceof OtuV2NotFoundError ||
		err instanceof ReferenceV2NotFoundError
	) {
		setResponseStatus(404);
		throw new ClientError("OTU not found.", 404);
	}
	if (err instanceof OtuV2ReferenceNotWritableError) {
		setResponseStatus(409);
		throw new ClientError("Reference cannot be modified.", 409);
	}
	if (err instanceof OtuV2ConflictError) {
		setResponseStatus(409);
		throw new ClientError("OTU already exists.", 409);
	}
	throw err;
});

export const createLocalOtuFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createLocalOtuSchema)
	.handler(async ({ context, data }) => {
		try {
			// The rights check runs before the create's archived/remote refusal, so a
			// caller without `modifyOtu` learns nothing about the Reference's state.
			// A non-administrator naming a missing Reference gets a 404 here; an
			// administrator passes and the create raises the same 404 from inside its
			// transaction.
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}

			const otu = await createLocalOtu(db, {
				referenceId: data.referenceId,
				userId: context.session.userId,
				command: data.command,
			});
			setResponseStatus(201);
			return otu;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getLocalOtuFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(otuReadSchema)
	.handler(async ({ context, data }) => {
		try {
			// An invisible Reference and a missing OTU both surface as a 404.
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtu(db, data.referenceId, data.otuId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
