import type { ErrorEvent, EventHint } from "@sentry/tanstackstart-react";
import {
	CLIENT_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";

const EXPECTED_CLIENT_ERROR_NAMES = new Set<string>([
	UNAUTHORIZED_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	CLIENT_ERROR_NAME,
]);

/**
 * Sentry `beforeSend` hook that drops errors the client caused before they are
 * reported.
 *
 * Three kinds slip through here, all routine rather than incidents: the auth
 * middleware's 401/403 rejections (`UnauthorizedError` / `ForbiddenError`),
 * whose name the client's retry guard reads to bounce to the login wall; the
 * handlers' deliberate 4xx `ClientError`s — a bad login, a missing record, a
 * name conflict — which the client renders as a message; and a request whose
 * socket closed before the response was written. Reporting any of them only
 * buries real errors in noise.
 */
export function dropExpectedClientErrors(
	event: ErrorEvent,
	hint: EventHint,
): ErrorEvent | null {
	if (
		isExpectedClientError(hint.originalException) ||
		eventReportsClientError(event) ||
		isClientDisconnect(hint.originalException)
	) {
		return null;
	}
	return event;
}

/**
 * Recognise the error Node raises when a client goes away mid-request.
 *
 * `abortIncoming` destroys every request still in flight on a socket that
 * closed, and the stack it produces is pure Node internals — no application
 * frame, because no application code ran. It is unactionable by construction:
 * the peer is gone. The web app draws a steady stream of these because the SSE
 * client probes `HEAD /events` from its `onerror` handler, which is exactly
 * when a deploy is tearing the connection down, so every connected tab
 * contributes one.
 *
 * The pair is matched, never the code alone. `ECONNRESET` also arrives from
 * connections this side *opens* — Postgres, object storage, GenBank — and those
 * are real incidents. Node's message here is the literal `aborted`.
 */
function isClientDisconnect(exception: unknown): boolean {
	return (
		exception instanceof Error &&
		exception.message === "aborted" &&
		(exception as { code?: unknown }).code === "ECONNRESET"
	);
}

function isExpectedClientError(exception: unknown): boolean {
	return (
		exception instanceof Error &&
		EXPECTED_CLIENT_ERROR_NAMES.has(exception.name)
	);
}

function eventReportsClientError(event: ErrorEvent): boolean {
	return (
		event.exception?.values?.some(
			(value) =>
				value.type !== undefined && EXPECTED_CLIENT_ERROR_NAMES.has(value.type),
		) ?? false
	);
}
