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
	| "disabled"
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
