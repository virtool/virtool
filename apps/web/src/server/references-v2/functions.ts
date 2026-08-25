import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { ReferenceV2CreateRequest } from "@virtool/contracts";
import { resolveReferenceActor } from "@virtool/data/references/data";
import {
	checkReferenceV2Visibility,
	createReferenceV2,
	getReferenceV2,
	ReferenceV2NotFoundError,
} from "@virtool/data/references-v2/data";
import { z } from "zod";
import { authenticated, permission } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";

const referenceIdSchema = z.object({
	referenceId: z.uuid(),
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
	throw err;
});

export const createReferenceV2Fn = createServerFn({ method: "POST" })
	.middleware([permission("create_ref")])
	.validator(ReferenceV2CreateRequest)
	.handler(async ({ context, data }) => {
		const reference = await createReferenceV2(db, {
			name: data.name,
			description: data.description,
			defaultSegmentLengthTolerance: data.defaultSegmentLengthTolerance,
			userId: context.session.userId,
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
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getReferenceV2(db, data.referenceId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
