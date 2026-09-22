import { createServerFn } from "@tanstack/react-start";
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
import {
	PROTECTED_OPERATIONS,
	type ProtectedOperation,
} from "../auth/freshness";
import { UnauthorizedError } from "../auth/middleware";
import {
	authenticated,
	recentlyAuthenticated,
	SessionNotFreshError,
} from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";
import {
	BrowserSessionEndedError,
	BrowserSessionNotFreshError,
	CurrentBrowserSessionError,
	getActiveBrowserSessions,
	revokeActiveBrowserSession,
	revokeOtherActiveBrowserSessions,
} from "./service";

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

const managementIdSchema = z.object({
	managementId: rowIdSchema,
});

function rethrowAsHttp(err: unknown): never {
	if (err instanceof ApiKeyNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("API key not found.", 404);
	}
	throw err;
}

function rethrowSessionManagementError(
	err: unknown,
	operation: ProtectedOperation,
): never {
	if (err instanceof BrowserSessionEndedError) {
		setResponseStatus(401);
		throw new UnauthorizedError();
	}
	if (err instanceof BrowserSessionNotFreshError) {
		setResponseStatus(403);
		throw new SessionNotFreshError(operation);
	}
	if (err instanceof CurrentBrowserSessionError) {
		setResponseStatus(400);
		throw new ClientError("Sign out to end the current browser session.", 400);
	}
	throw err;
}

/** List the signed-in user's live Better Auth browser sessions. */
export const findActiveBrowserSessionsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }) => {
		if (context.principal.sessionStore !== "better_auth") {
			setResponseStatus(403);
			throw new ClientError(
				"Active session management is unavailable for this session.",
				403,
			);
		}

		try {
			return await getActiveBrowserSessions(
				db,
				context.principal.userId,
				context.principal.sessionId,
			);
		} catch (err) {
			return rethrowSessionManagementError(
				err,
				PROTECTED_OPERATIONS.sessionRevokeOther,
			);
		}
	});

/** Revoke one selected browser session other than the caller's current one. */
export const revokeBrowserSessionFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.sessionRevokeOther)])
	.validator(managementIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await revokeActiveBrowserSession(
				db,
				context.principal.userId,
				context.principal.sessionId,
				data.managementId,
			);
			return null;
		} catch (err) {
			return rethrowSessionManagementError(
				err,
				PROTECTED_OPERATIONS.sessionRevokeOther,
			);
		}
	});

/** Revoke every browser session belonging to the user except the current one. */
export const revokeOtherBrowserSessionsFn = createServerFn({ method: "POST" })
	.middleware([
		recentlyAuthenticated(PROTECTED_OPERATIONS.sessionRevokeAllOther),
	])
	.handler(async ({ context }) => {
		try {
			return {
				revoked: await revokeOtherActiveBrowserSessions(
					db,
					context.principal.userId,
					context.principal.sessionId,
				),
			};
		} catch (err) {
			return rethrowSessionManagementError(
				err,
				PROTECTED_OPERATIONS.sessionRevokeAllOther,
			);
		}
	});

export const findApiKeysFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }) => findApiKeys(db, context.principal.userId));

export const createApiKeyFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.apiKeyCreate)])
	.validator(createApiKeySchema)
	.handler(async ({ context, data }) => {
		const { key, apiKey } = await createApiKey(db, context.principal.userId, {
			name: data.name,
			permissions: data.permissions,
		});
		setResponseStatus(201);
		return { ...apiKey, key };
	});

export const updateApiKeyFn = createServerFn({ method: "POST" })
	.middleware([
		recentlyAuthenticated(PROTECTED_OPERATIONS.apiKeyPermissionsUpdate),
	])
	.validator(updateApiKeySchema)
	.handler(async ({ context, data }) => {
		try {
			return await updateApiKey(
				db,
				context.principal.userId,
				data.keyId,
				data.permissions,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteApiKeyFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.apiKeyDelete)])
	.validator(keyIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await deleteApiKey(db, context.principal.userId, data.keyId);
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
