import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	DEFAULT_PASSKEY_NAME,
	type PasskeySummary,
	passkeyNameSchema,
	permissionsSchema,
} from "@virtool/contracts";
import {
	ApiKeyNotFoundError,
	createApiKey,
	deleteApiKey,
	findApiKeys,
	updateApiKey,
} from "@virtool/data/account/data";
import {
	findPasskeys,
	PasskeyFallbackMissingError,
} from "@virtool/data/auth/passkeys";
import { users } from "@virtool/data/db/schema/users";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
	PROTECTED_OPERATIONS,
	type ProtectedOperation,
} from "../auth/freshness";
import { UnauthorizedError } from "../auth/middleware";
import {
	generatePasskeyRegistrationOptions,
	registrationResponseSchema,
	verifyPasskeyRegistration,
} from "../auth/passkeyActions";
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
	PasskeyNotFoundError,
	removeAccountPasskey,
	renameAccountPasskey,
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

const renamePasskeySchema = managementIdSchema.extend({
	name: passkeyNameSchema,
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

function rethrowPasskeyError(
	err: unknown,
	operation: ProtectedOperation,
): never {
	if (err instanceof PasskeyNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Passkey not found.", 404);
	}
	if (err instanceof PasskeyFallbackMissingError) {
		setResponseStatus(409);
		throw new ClientError(
			"Set a password for your account before removing a passkey.",
			409,
		);
	}
	if (err instanceof APIError) {
		if (err.body?.code === "SESSION_NOT_FRESH") {
			setResponseStatus(403);
			throw new SessionNotFreshError(operation);
		}
		if (err.statusCode === 401) {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}
		if (err.body?.code === "PASSKEY_ALREADY_REGISTERED") {
			setResponseStatus(409);
			throw new ClientError("This passkey is already registered.", 409);
		}
		// The plugin reports a response that fails verification, including one
		// signed for another origin, as a server error.
		if (
			err.statusCode < 500 ||
			err.body?.code === "FAILED_TO_VERIFY_REGISTRATION"
		) {
			setResponseStatus(400);
			throw new ClientError(
				"The passkey could not be registered. Try again.",
				400,
			);
		}
	}
	return rethrowSessionManagementError(err, operation);
}

/** List the signed-in user's passkeys without any credential material. */
export const findPasskeysFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }) => {
		if (context.principal.sessionStore !== "better_auth") {
			setResponseStatus(403);
			throw new ClientError(
				"Passkey management is unavailable for this session.",
				403,
			);
		}
		return findPasskeys(db, context.principal.userId);
	});

/** Start registering a passkey for the signed-in user. */
export const getPasskeyRegistrationOptionsFn = createServerFn({
	method: "POST",
})
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.passkeyRegister)])
	.handler(async ({ context }) => {
		const [user] = await db
			.select({ handle: users.handle })
			.from(users)
			.where(eq(users.id, context.principal.userId))
			.limit(1);
		if (!user) {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}

		try {
			return await generatePasskeyRegistrationOptions(user.handle);
		} catch (err) {
			return rethrowPasskeyError(err, PROTECTED_OPERATIONS.passkeyRegister);
		}
	});

/** Verify the browser's registration response and store the passkey. */
export const registerPasskeyFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.passkeyRegister)])
	.validator(z.object({ response: registrationResponseSchema }))
	.handler(async ({ data }): Promise<PasskeySummary> => {
		try {
			const passkey = await verifyPasskeyRegistration(data.response);
			setResponseStatus(201);
			return {
				managementId: Number(passkey.id),
				name: passkey.name || DEFAULT_PASSKEY_NAME,
				createdAt: passkey.createdAt ?? null,
				multiDevice: passkey.deviceType === "multiDevice",
				backedUp: passkey.backedUp,
			};
		} catch (err) {
			return rethrowPasskeyError(err, PROTECTED_OPERATIONS.passkeyRegister);
		}
	});

/** Rename one of the signed-in user's passkeys. */
export const renamePasskeyFn = createServerFn({ method: "POST" })
	.middleware([
		recentlyAuthenticated(PROTECTED_OPERATIONS.passkeySecurityUpdate),
	])
	.validator(renamePasskeySchema)
	.handler(async ({ context, data }) => {
		try {
			return await renameAccountPasskey(
				db,
				context.principal.userId,
				context.principal.sessionId,
				data.managementId,
				data.name,
			);
		} catch (err) {
			return rethrowPasskeyError(
				err,
				PROTECTED_OPERATIONS.passkeySecurityUpdate,
			);
		}
	});

/**
 * Remove one of the signed-in user's passkeys.
 *
 * The user's password, TOTP enrollment, recovery codes, API keys and sessions
 * are untouched, including the session the passkey signed in.
 */
export const removePasskeyFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.passkeyRemove)])
	.validator(managementIdSchema)
	.handler(async ({ context, data }) => {
		try {
			await removeAccountPasskey(
				db,
				context.principal.userId,
				context.principal.sessionId,
				data.managementId,
			);
			return null;
		} catch (err) {
			return rethrowPasskeyError(err, PROTECTED_OPERATIONS.passkeyRemove);
		}
	});
