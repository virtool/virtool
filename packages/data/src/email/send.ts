// The one place Virtool talks to Resend.
//
// Everything provider-specific — the SDK, its error names, its idempotency
// header, its retry guidance — is folded into a provider-neutral outcome here,
// so neither the outbox runner nor the test-delivery path interprets Resend
// errors themselves. Nothing in this module logs: the API key and the
// recipient pass through it, and classification gives callers everything they
// need to log safely.

import { createHash } from "node:crypto";
import { type CreateEmailRequestOptions, Resend } from "resend";

/** How long one send may run before it is abandoned as retryable. */
export const EMAIL_SEND_TIMEOUT_MS = 15_000;

/** What one provider send needs. */
export type EmailSendRequest = {
	apiKey: string;
	html: string;
	/** Sent as the `Idempotency-Key` header, verbatim. */
	idempotencyKey: string;
	recipient: string;
	/** Empty routes replies to the sender address. */
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
	signal?: AbortSignal;
	subject: string;
	text: string;
};

/**
 * A provider send folded into the outcomes the outbox acts on.
 *
 * `accepted` is the provider taking the message, not mailbox delivery.
 * `configuration` means the API key itself was rejected — a problem with the
 * instance, not the message, so the row should not spend an attempt on it.
 * `error` fields are safe to store on the row but must not become metric
 * labels.
 */
export type EmailSendOutcome =
	| { outcome: "accepted"; providerMessageId: string }
	| { outcome: "retryable"; error: string; retryAfterSeconds?: number }
	| { outcome: "rate_limited"; error: string; retryAfterSeconds?: number }
	| { outcome: "configuration"; error: string }
	| { outcome: "permanent"; error: string };

/**
 * The provider idempotency key for one outbox row.
 *
 * Deterministic from the row's identity and its domain key, and deliberately
 * **not** varied per attempt: the key is what turns an ambiguous outcome — a
 * timeout after the provider already accepted — into a dedupe on the retry
 * rather than a duplicate message. The domain key is hashed rather than
 * embedded because Resend caps the header at 256 characters and callers own
 * the domain key's length.
 */
export function buildProviderIdempotencyKey(
	outboxId: number,
	domainKey: string,
): string {
	const digest = createHash("sha256")
		.update(domainKey)
		.digest("hex")
		.slice(0, 32);

	return `outbox/${outboxId}/${digest}`;
}

/** The error names Resend uses for a key problem rather than a message problem. */
const CONFIGURATION_ERRORS = new Set([
	"invalid_access",
	"invalid_api_key",
	"missing_api_key",
	"restricted_api_key",
]);

/** The 429 family: the message is fine, the sending rate or quota is not. */
const RATE_LIMIT_ERRORS = new Set([
	"daily_quota_exceeded",
	"monthly_quota_exceeded",
	"rate_limit_exceeded",
]);

/** Transient provider trouble worth an ordinary retry. */
const RETRYABLE_ERRORS = new Set([
	"application_error",
	"concurrent_idempotent_requests",
	"internal_server_error",
]);

function parseRetryAfter(
	headers: Record<string, string> | null,
): number | undefined {
	const value = headers?.["retry-after"];

	if (!value) {
		return undefined;
	}

	const seconds = Number(value);

	return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function formatSender(name: string, address: string): string {
	return name === "" ? address : `${name} <${address}>`;
}

/**
 * Send one message through the official Resend SDK.
 *
 * Never throws and never returns secret material: the SDK reports errors as
 * values, network failures included, and every path folds onto
 * {@link EmailSendOutcome}. Unknown error names classify by status code — 5xx
 * and unreachable retry, anything else is permanent.
 *
 * The request is bounded by {@link EMAIL_SEND_TIMEOUT_MS} and the caller's
 * signal. The SDK spreads its request options into the `fetch` init, which is
 * what carries `signal` through; an abort surfaces as the SDK's network-error
 * value and classifies as retryable.
 */
export async function sendEmailViaResend(
	request: EmailSendRequest,
): Promise<EmailSendOutcome> {
	const resend = new Resend(request.apiKey);

	const timeout = AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS);
	const signal = request.signal
		? AbortSignal.any([request.signal, timeout])
		: timeout;

	const { data, error, headers } = await resend.emails.send(
		{
			from: formatSender(request.senderName, request.senderAddress),
			to: [request.recipient],
			subject: request.subject,
			text: request.text,
			html: request.html,
			...(request.replyToAddress !== "" && {
				replyTo: request.replyToAddress,
			}),
		},
		{
			idempotencyKey: request.idempotencyKey,
			signal,
		} as CreateEmailRequestOptions,
	);

	if (data) {
		return { outcome: "accepted", providerMessageId: data.id };
	}

	if (error === null) {
		return { outcome: "retryable", error: "the provider returned no result" };
	}

	const message = `${error.name}: ${error.message}`.slice(0, 500);

	if (CONFIGURATION_ERRORS.has(error.name)) {
		return { outcome: "configuration", error: message };
	}

	if (RATE_LIMIT_ERRORS.has(error.name)) {
		return {
			outcome: "rate_limited",
			error: message,
			retryAfterSeconds: parseRetryAfter(headers),
		};
	}

	if (RETRYABLE_ERRORS.has(error.name)) {
		return {
			outcome: "retryable",
			error: message,
			retryAfterSeconds: parseRetryAfter(headers),
		};
	}

	if (error.statusCode === null || error.statusCode >= 500) {
		return { outcome: "retryable", error: message };
	}

	return { outcome: "permanent", error: message };
}
