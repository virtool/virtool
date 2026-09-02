import { createHash } from "node:crypto";
import type { ErrorResponse } from "resend";
import { type CreateEmailRequestOptions, Resend } from "resend";

export const EMAIL_SEND_TIMEOUT_MS = 15_000;

/** What one provider send needs. */
export type EmailSendRequest = {
	apiKey: string;
	html: string;
	idempotencyKey: string;
	recipient: string;
	/** Empty routes replies to the sender address. */
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
	signal?: AbortSignal;
	subject: string;
	text: string;
	timeoutMs?: number;
};

/**
 * The provider's own error identifier, or `unknown` when it sent none.
 *
 * Resend draws these from a closed set, so a caller may show one to an
 * administrator. The accompanying `error` string carries the provider's free
 * text and belongs in logs only.
 */
export type EmailSendErrorCode = ErrorResponse["name"] | "unknown";

/** The classified outcome of a provider send. */
export type EmailSendOutcome =
	| { outcome: "accepted"; providerMessageId: string }
	| {
			outcome: "retryable";
			code: EmailSendErrorCode;
			error: string;
			retryAfterSeconds?: number;
			timedOut?: boolean;
	  }
	| {
			outcome: "rate_limited";
			code: EmailSendErrorCode;
			error: string;
			retryAfterSeconds?: number;
	  }
	| { outcome: "configuration"; code: EmailSendErrorCode; error: string }
	| { outcome: "permanent"; code: EmailSendErrorCode; error: string };

/** The sender fields that Resend sees in the message body. */
export type EmailSenderEnvelope = {
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
};

/**
 * Build the provider idempotency key for an outbox row.
 *
 * The key stays the same across retries of one message, so an ambiguous
 * outcome cannot double-send. A changed sender envelope is a different
 * message and gets its own key, because the provider rejects a reused key
 * that carries a different payload.
 */
export function buildProviderIdempotencyKey(
	outboxId: number,
	domainKey: string,
	envelope: EmailSenderEnvelope,
): string {
	const digest = createHash("sha256")
		.update(
			JSON.stringify([
				domainKey,
				envelope.replyToAddress,
				envelope.senderAddress,
				envelope.senderName,
			]),
		)
		.digest("hex")
		.slice(0, 32);

	return `outbox/${outboxId}/${digest}`;
}

const CONFIGURATION_ERRORS = new Set([
	"invalid_access",
	"invalid_api_key",
	"missing_api_key",
	"restricted_api_key",
]);

const RATE_LIMIT_ERRORS = new Set([
	"daily_quota_exceeded",
	"monthly_quota_exceeded",
	"rate_limit_exceeded",
]);

const RETRYABLE_ERRORS = new Set([
	"application_error",
	"concurrent_idempotent_requests",
	"internal_server_error",
	"invalid_idempotent_request",
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

const PLAIN_SENDER_NAME = /^[A-Za-z0-9 !#$%&'*+\-/=?^_`{|}~.]*$/;

/**
 * Compose the `From` value.
 *
 * A name holding `<`, `>`, `"` or a comma is not a valid unquoted display
 * name, and the provider rejects the whole message as a validation error. Such
 * a name is quoted, with the two characters that cannot appear inside a quoted
 * string escaped.
 */
export function formatSender(name: string, address: string): string {
	if (name === "") {
		return address;
	}

	if (PLAIN_SENDER_NAME.test(name)) {
		return `${name} <${address}>`;
	}

	const quoted = name.replace(/[\\"]/g, "\\$&");

	return `"${quoted}" <${address}>`;
}

/** Send one email through Resend and classify the result. */
export async function sendEmailViaResend(
	request: EmailSendRequest,
): Promise<EmailSendOutcome> {
	const resend = new Resend(request.apiKey);

	const timeout = AbortSignal.timeout(
		request.timeoutMs ?? EMAIL_SEND_TIMEOUT_MS,
	);
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
	const timedOut = timeout.aborted && !request.signal?.aborted;

	if (data) {
		return { outcome: "accepted", providerMessageId: data.id };
	}

	if (error === null) {
		return {
			outcome: "retryable",
			code: "unknown",
			error: "the provider returned no result",
			...(timedOut && { timedOut: true }),
		};
	}

	const code = error.name;
	const message = `${code}: ${error.message}`.slice(0, 500);

	if (CONFIGURATION_ERRORS.has(code)) {
		return { outcome: "configuration", code, error: message };
	}

	if (RATE_LIMIT_ERRORS.has(code)) {
		return {
			outcome: "rate_limited",
			code,
			error: message,
			retryAfterSeconds: parseRetryAfter(headers),
		};
	}

	if (RETRYABLE_ERRORS.has(code)) {
		return {
			outcome: "retryable",
			code,
			error: message,
			retryAfterSeconds: parseRetryAfter(headers),
			...(timedOut && { timedOut: true }),
		};
	}

	if (error.statusCode === null || error.statusCode >= 500) {
		return {
			outcome: "retryable",
			code,
			error: message,
			...(timedOut && { timedOut: true }),
		};
	}

	return { outcome: "permanent", code, error: message };
}
