/**
 * The template names transactional email can be sent with.
 *
 * A finite union rather than caller-supplied HTML: templates render centrally,
 * so a dependent feature can enqueue mail without owning markup or escaping.
 */
export const emailTemplateTypes = [
	"account_setup",
	"email_verification",
	"password_recovery",
	"test",
] as const;

/** The name of a transactional email template. */
export type EmailTemplateType = (typeof emailTemplateTypes)[number];

/** A transactional email template name with its typed, recipient-safe data. */
export type EmailTemplate =
	| { type: "account_setup"; username: string; setupUrl: string }
	| { type: "email_verification"; username: string; verifyUrl: string }
	| { type: "password_recovery"; username: string; recoveryUrl: string }
	| { type: "test" };

/**
 * Whether transactional email delivery can currently send.
 *
 * `disabled` and `unconfigured` are supported states — a disconnected
 * installation runs without email and auth workflows fall back to copyable
 * links. `configuration_error` is the one that needs an operator: a stored API
 * key exists but cannot be decrypted with the master keys this process holds.
 */
export type EmailAvailability =
	| "disabled"
	| "unconfigured"
	| "ready"
	| "configuration_error";

/**
 * The email delivery settings as an administration client reads them.
 *
 * The Resend API key never crosses the wire in any recoverable form:
 * `hasApiKey` reports only whether one is stored.
 */
export type EmailSettings = {
	availability: EmailAvailability;
	enabled: boolean;
	hasApiKey: boolean;
	/** Empty when replies go to the sender address. */
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
};

/** Why a test delivery did not go through. */
export type EmailTestFailureReason =
	| "unavailable"
	| "provider_rejected"
	| "provider_unavailable";

/** The outcome of a test delivery, narrow enough for a settings UI. */
export type EmailTestResult =
	| { ok: true }
	| { ok: false; reason: EmailTestFailureReason; message: string };

/** The outcome of re-encrypting the stored API key under the active master key. */
export type EmailReencryptResult =
	| "reencrypted"
	| "already_current"
	| "no_key"
	| "unavailable";
