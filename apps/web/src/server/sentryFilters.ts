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
 * client went away before its response finished. Reporting any of them only
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
 * Recognise a client that went away mid-request, in either shape it arrives in.
 *
 * Both are unactionable by construction: the peer is gone before anything this
 * side could act on. Each is matched as a *pair* of fields, because the halves
 * on their own are shapes we want reported.
 */
function isClientDisconnect(exception: unknown): boolean {
	return isSocketReset(exception) || isRequestAbort(exception);
}

/**
 * Recognise the error Node raises when a socket closes with a request on it.
 *
 * `abortIncoming` destroys every request still in flight, and the stack it
 * produces is pure Node internals — no application frame, because no
 * application code ran. The web app draws a steady stream of these because the
 * SSE client probes `HEAD /events` from its `onerror` handler, which is exactly
 * when a deploy is tearing the connection down, so every connected tab
 * contributes one.
 *
 * The pair is matched, never the code alone. `ECONNRESET` also arrives from
 * connections this side *opens* — Postgres, object storage, GenBank — and those
 * are real incidents. Node's message here is the literal `aborted`.
 */
function isSocketReset(exception: unknown): boolean {
	return (
		exception instanceof Error &&
		exception.message === "aborted" &&
		(exception as { code?: unknown }).code === "ECONNRESET"
	);
}

/**
 * Recognise the `AbortError` srvx raises when a response outlives its client.
 *
 * srvx arms an `AbortController` on every request and fires it from the
 * response's `close` event whenever the socket goes before the body finished
 * writing. Aborting without a reason mints node's default
 * `DOMException("This operation was aborted", "AbortError")`, which surfaces
 * out of the response pipe and is reported unhandled — with the request's own
 * status already recorded as a success, because the handler had long since
 * returned. The steady source is `POST /monitoring`: the browser SDK flushes
 * its envelopes on unload, so the tab is usually gone before the tunnel has
 * finished streaming Sentry's reply back to it.
 *
 * The message is matched alongside the name, and that pairing is what keeps a
 * genuine abort reportable: `AbortSignal.timeout` raises a `TimeoutError`, and
 * an `abort(reason)` carries the reason instead. Nothing in this process aborts
 * bare — a future caller that does would land here silently.
 */
function isRequestAbort(exception: unknown): boolean {
	return (
		exception instanceof Error &&
		exception.name === "AbortError" &&
		exception.message === "This operation was aborted"
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
