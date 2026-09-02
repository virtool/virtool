import { randomUUID } from "node:crypto";
import type { EmailTestFailureCode, EmailTestResult } from "@virtool/contracts";
import type { Keyring } from "../crypto/keyring";
import type { Db } from "../db/pg";
import {
	type EmailSendErrorCode,
	type EmailSendOutcome,
	sendEmailViaResend,
} from "./send";
import { getEmailSettings, resolveEmailDelivery } from "./settings";
import { renderEmailTemplate } from "./templates";

/**
 * Resend's own identifiers for the things an administrator can act on.
 *
 * Anything absent falls back to the class of the outcome, so an identifier we
 * have never seen still produces a bounded code.
 */
const FAILURE_CODES_BY_PROVIDER_CODE: Partial<
	Record<EmailSendErrorCode, EmailTestFailureCode>
> = {
	invalid_from_address: "invalid_sender",
	invalid_parameter: "invalid_request",
	missing_required_field: "invalid_request",
	validation_error: "invalid_request",
};

function toFailureCode(outcome: EmailSendOutcome): EmailTestFailureCode {
	switch (outcome.outcome) {
		case "accepted":
			throw new Error("an accepted send has no failure code");

		case "configuration":
			return "authentication";

		case "rate_limited":
			return "rate_limited";

		case "retryable":
			return outcome.timedOut ? "timeout" : "provider_unavailable";

		case "permanent":
			return FAILURE_CODES_BY_PROVIDER_CODE[outcome.code] ?? "unknown";
	}
}

/**
 * Send the dedicated test template to `recipient` using the stored
 * configuration.
 *
 * Works while delivery is disabled — that is the point: an administrator
 * validates the configuration before enabling it — and never enables anything.
 * Each call carries a fresh idempotency key, so an explicit retry really does
 * send again. The result is narrow enough for a settings UI: a bounded code the
 * caller words itself, never the provider's own text, and never credentials.
 */
export async function sendTestEmail(
	db: Db,
	keyring: Keyring,
	recipient: string,
): Promise<EmailTestResult> {
	const state = resolveEmailDelivery(await getEmailSettings(db), keyring);

	if (state.availability === "unconfigured") {
		return { ok: false, code: "unavailable" };
	}

	if (state.apiKey === null) {
		return { ok: false, code: "authentication" };
	}

	const rendered = renderEmailTemplate({ type: "test" });

	let outcome: EmailSendOutcome;

	try {
		outcome = await sendEmailViaResend({
			apiKey: state.apiKey,
			html: rendered.html,
			idempotencyKey: `test/${randomUUID()}`,
			recipient,
			replyToAddress: state.settings.replyToAddress,
			senderAddress: state.settings.senderAddress,
			senderName: state.settings.senderName,
			subject: rendered.subject,
			text: rendered.text,
		});
	} catch (err) {
		// The send carries its own deadline, and an expired one aborts the request
		// rather than answering.
		const aborted =
			err instanceof Error &&
			(err.name === "TimeoutError" || err.name === "AbortError");

		return { ok: false, code: aborted ? "timeout" : "provider_unavailable" };
	}

	if (outcome.outcome === "accepted") {
		return { ok: true, providerMessageId: outcome.providerMessageId };
	}

	return { ok: false, code: toFailureCode(outcome) };
}
