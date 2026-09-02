import { createHash } from "node:crypto";
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
};

/** The classified outcome of a provider send. */
export type EmailSendOutcome =
	| { outcome: "accepted"; providerMessageId: string }
	| { outcome: "retryable"; error: string; retryAfterSeconds?: number }
	| { outcome: "rate_limited"; error: string; retryAfterSeconds?: number }
	| { outcome: "configuration"; error: string }
	| { outcome: "permanent"; error: string };

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

function formatSender(name: string, address: string): string {
	return name === "" ? address : `${name} <${address}>`;
}

/** Send one email through Resend and classify the result. */
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
