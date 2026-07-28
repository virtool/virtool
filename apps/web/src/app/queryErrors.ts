import { endSession } from "@app/session";
import * as Sentry from "@sentry/tanstackstart-react";
import {
	FORBIDDEN_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";

/**
 * A failed query's error. A server function's `ClientError` arrives with the
 * HTTP status on `status`, carried across the boundary by
 * `serverErrorSerializationAdapter`.
 */
export type QueryError = Error & {
	status?: number;
};

const NON_RETRYABLE_STATUSES = new Set([401, 403, 404]);

/**
 * The HTTP status behind a failed query.
 *
 * A server function's `ClientError` arrives as a plain `Error` with `status` as
 * an own property, put there by `serverErrorSerializationAdapter`.
 *
 * Returns `undefined` for an error that carries no status at all — a network
 * failure, a thrown `ZodError`, a bug.
 */
export function getErrorStatus(error: unknown): number | undefined {
	if (error === null || typeof error !== "object") {
		return undefined;
	}
	return (error as QueryError).status;
}

/**
 * Whether an error is a zod validation failure — the API returned a payload a
 * response schema rejected, i.e. the client/server contract has drifted.
 *
 * Matched by `name` rather than `instanceof ZodError` so this module, which is
 * reached eagerly from `router.tsx`, does not pull zod into the login-wall
 * bundle.
 */
function isValidationError(error: Error): boolean {
	return error.name === "ZodError";
}

/**
 * Surface a contract-drift validation error to the console and Sentry.
 *
 * React Query swallows a rejected `.parse()` into query state, so without this
 * it reaches neither place and the drift fails silently — which is how the
 * index integer-id cutover broke the analysis dialog in production unseen
 * (VIR-2804). The dev console is the only place a developer sees it locally,
 * where Sentry has no DSN; Sentry carries it in production.
 */
function reportContractDrift(error: Error): void {
	if (import.meta.env.DEV) {
		// biome-ignore lint/suspicious/noConsole: contract drift is otherwise invisible in local dev, where Sentry has no DSN
		console.error(error);
	}
	Sentry.captureException(error, { tags: { contract: "drift" } });
}

/**
 * Handle a settled query or mutation error at the cache boundary.
 *
 * Wired into the query and mutation caches' `onError`. Ends the session when it
 * is gone, and reports a drifted contract so it fails loudly.
 */
// Server-function errors reach the client with their `name` preserved only
// because `serverErrorSerializationAdapter` (start.ts) carries it past Router's
// ShallowErrorPlugin, so a 401 is matched by name here.
//
// A 403 is deliberately not handled: the session is valid, the user just lacks
// the role, so bouncing them to the login wall would be wrong.
export function handleQueryError(error: Error): void {
	if (error.name === UNAUTHORIZED_ERROR_NAME) {
		endSession();
	}

	if (isValidationError(error)) {
		reportContractDrift(error);
	}
}

/** Decide whether React Query should retry a failed query. */
export function shouldRetryQuery(
	failureCount: number,
	error: QueryError,
): boolean {
	const status = getErrorStatus(error);
	if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) {
		return false;
	}
	// TanStack Start server-function errors cross the boundary with only
	// `message` preserved by default; the status set via `setResponseStatus` is
	// not attached, and Router's ShallowErrorPlugin drops `name`.
	// `serverErrorSerializationAdapter` (registered in start.ts) keeps the auth
	// errors' `name`, so matching by name here makes a 401/403 (e.g. after
	// logout, or an unauthenticated first visit) reject immediately instead of
	// retrying ~4× while the screen sits blank before the route can bounce to
	// /login.
	if (
		error.name === UNAUTHORIZED_ERROR_NAME ||
		error.name === FORBIDDEN_ERROR_NAME
	) {
		return false;
	}
	// A schema validation failure means the response shape is wrong; the same
	// request will fail identically, so surface it now instead of after ~4
	// retries.
	if (isValidationError(error)) {
		return false;
	}
	return failureCount <= 3;
}
