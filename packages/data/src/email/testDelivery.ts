import { randomUUID } from "node:crypto";
import type { EmailTestResult } from "@virtool/contracts";
import type { Keyring } from "../crypto/keyring";
import type { Db } from "../db/pg";
import { sendEmailViaResend } from "./send";
import { getEmailSettings, resolveEmailDelivery } from "./settings";
import { renderEmailTemplate } from "./templates";

/**
 * Send the dedicated test template to `recipient` using the stored
 * configuration.
 *
 * Works while delivery is disabled — that is the point: an administrator
 * validates the configuration before enabling it — and never enables anything.
 * Each call carries a fresh idempotency key, so an explicit retry really does
 * send again. The result is narrow enough for a settings UI and never carries
 * credentials.
 */
export async function sendTestEmail(
	db: Db,
	keyring: Keyring,
	recipient: string,
): Promise<EmailTestResult> {
	const state = resolveEmailDelivery(await getEmailSettings(db), keyring);

	if (state.availability === "unconfigured") {
		return {
			ok: false,
			reason: "unavailable",
			message:
				"Email is not configured. Store an API key and a sender address first.",
		};
	}

	if (state.apiKey === null) {
		return {
			ok: false,
			reason: "unavailable",
			message:
				"The stored API key cannot be decrypted with the configured encryption key.",
		};
	}

	const rendered = renderEmailTemplate({ type: "test" });

	const outcome = await sendEmailViaResend({
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

	switch (outcome.outcome) {
		case "accepted":
			return { ok: true };

		case "configuration":
			return {
				ok: false,
				reason: "provider_rejected",
				message: "The provider rejected the stored API key.",
			};

		case "permanent":
			return {
				ok: false,
				reason: "provider_rejected",
				message: outcome.error,
			};

		case "rate_limited":
		case "retryable":
			return {
				ok: false,
				reason: "provider_unavailable",
				message: outcome.error,
			};
	}
}
