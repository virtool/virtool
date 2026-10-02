import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import {
	type AccountSecurity,
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
import { getAccountSecurity } from "@virtool/data/users/data";
import { APIError } from "better-auth/api";
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

/** The fields of a Better Auth passkey row that its owner may see. */
type PasskeyRow = {
	id: string | number;
	name?: string | null;
	createdAt?: Date | null;
	deviceType: string;
	backedUp: boolean;
};

function toPasskeySummary(row: PasskeyRow): PasskeySummary {
	return {
		managementId: Number(row.id),
		name: row.name || DEFAULT_PASSKEY_NAME,
		createdAt: row.createdAt ?? null,
		multiDevice: row.deviceType === "multiDevice",
		backedUp: row.backedUp,
	};
}

function compareCreatedAt(a: PasskeySummary, b: PasskeySummary): number {
	return (
		(a.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY) -
			(b.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY) ||
		a.managementId - b.managementId
	);
}

/**
 * Map a Better Auth refusal from a passkey management call.
 *
 * The plugin answers another user's passkey with a 401 that has no
 * `UNAUTHORIZED` code, and a missing passkey with a 404. Both mean "not yours"
 * to the caller. An ended session has the `UNAUTHORIZED` code.
 */
function rethrowPasskeyError(err: unknown): never {
	if (err instanceof APIError) {
		if (err.body?.code === "UNAUTHORIZED") {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}
		if (err.statusCode === 401 || err.statusCode === 404) {
			setResponseStatus(404);
			throw new ClientError("Passkey not found.", 404);
		}
	}
	throw err;
}

// Read the session without rolling its expiry, as every server function does.
const READ_ONLY_SESSION = { disableRefresh: true } as const;

async function loadAuth() {
	const { auth } = await import("../auth/instance");
	return { auth, headers: getRequest().headers };
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

		const { auth, headers } = await loadAuth();
		try {
			const rows = await auth.api.listPasskeys({
				headers,
				query: READ_ONLY_SESSION,
			});
			return rows.map(toPasskeySummary).sort(compareCreatedAt);
		} catch (err) {
			return rethrowPasskeyError(err);
		}
	});

/** Rename one of the signed-in user's passkeys. */
export const renamePasskeyFn = createServerFn({ method: "POST" })
	.middleware([
		recentlyAuthenticated(PROTECTED_OPERATIONS.passkeySecurityUpdate),
	])
	.validator(renamePasskeySchema)
	.handler(async ({ data }): Promise<PasskeySummary> => {
		const { auth, headers } = await loadAuth();
		try {
			const { passkey } = await auth.api.updatePasskey({
				headers,
				query: READ_ONLY_SESSION,
				body: { id: String(data.managementId), name: data.name },
			});
			return toPasskeySummary(passkey);
		} catch (err) {
			return rethrowPasskeyError(err);
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
	.handler(async ({ data }) => {
		const { auth, headers } = await loadAuth();
		try {
			await auth.api.deletePasskey({
				headers,
				query: READ_ONLY_SESSION,
				body: { id: String(data.managementId) },
			});
			return null;
		} catch (err) {
			return rethrowPasskeyError(err);
		}
	});

/**
 * Read the signed-in user's email verification, TOTP, and recovery-code state.
 *
 * Only the number of recovery codes leaves the server, never the codes.
 */
export const getAccountSecurityFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.handler(async ({ context }): Promise<AccountSecurity> => {
		const security = await getAccountSecurity(db, context.principal.userId);

		if (!security.twoFactorEnabled) {
			return { ...security, recoveryCodesRemaining: null };
		}

		const { auth } = await loadAuth();
		const { backupCodes } = await auth.api.viewBackupCodes({
			body: { userId: String(context.principal.userId) },
		});

		return { ...security, recoveryCodesRemaining: backupCodes.length };
	});
