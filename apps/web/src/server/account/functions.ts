import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { permissionsSchema } from "@virtool/contracts";
import {
	ApiKeyNotFoundError,
	createApiKey,
	deleteApiKey,
	findApiKeys,
	updateApiKey,
} from "@virtool/data/account/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const createApiKeySchema = z.object({
	name: z.string().trim().min(1),
	permissions: permissionsSchema.partial().default({}),
});

const keyIdSchema = z.object({
	keyId: rowIdSchema,
});

const updateApiKeySchema = keyIdSchema.extend({
	permissions: permissionsSchema.partial().default({}),
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// ApiKeyNotFoundError import it references — from the client bundle. A plain
// top-level helper would pin ./data and its postgres transitive dependency in
// the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof ApiKeyNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("API key not found.");
	}
	throw err;
});

export const findApiKeysFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }) => findApiKeys(db, context.session.userId));

export const createApiKeyFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createApiKeySchema)
	.handler(async ({ context, data }) => {
		const { key, apiKey } = await createApiKey(db, context.session.userId, {
			name: data.name,
			permissions: data.permissions,
		});
		setResponseStatus(201);
		return { ...apiKey, key };
	});

export const updateApiKeyFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateApiKeySchema)
	.handler(async ({ context, data }) => {
		try {
			return await updateApiKey(
				db,
				context.session.userId,
				data.keyId,
				data.permissions,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteApiKeyFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(keyIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await deleteApiKey(db, context.session.userId, data.keyId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
