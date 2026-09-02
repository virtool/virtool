/** The supported transactional email template names. */
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

/** Whether transactional email can currently be delivered. */
export type EmailAvailability =
	| "unconfigured"
	| "ready"
	| "configuration_error";

/** The non-secret email delivery settings exposed to administrators. */
export type EmailSettings = {
	availability: EmailAvailability;
	enabled: boolean;
	hasApiKey: boolean;
	/** Empty when replies go to the sender address. */
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
};

/**
 * Why a test delivery did not go through.
 *
 * A closed set, so the settings UI owns the wording and no provider text
 * reaches the browser.
 */
export type EmailTestFailureCode =
	| "unavailable"
	| "authentication"
	| "invalid_sender"
	| "invalid_request"
	| "rate_limited"
	| "provider_unavailable"
	| "timeout"
	| "unknown";

/**
 * The outcome of a test delivery, narrow enough for a settings UI.
 *
 * Acceptance is the provider taking the message, not proof it reached a
 * mailbox. The message id is a diagnostic handle for support, nothing more.
 */
export type EmailTestResult =
	| { ok: true; providerMessageId: string }
	| { ok: false; code: EmailTestFailureCode };
