import type { EmailSettings } from "@virtool/contracts";

/**
 * Create fake email delivery settings.
 *
 * The default is a ready instance, because that is the state most views under
 * test care about.
 *
 * @param overrides - optional properties for creating fake settings with specific values
 */
export function createFakeEmailSettings(
	overrides?: Partial<EmailSettings>,
): EmailSettings {
	return {
		availability: "ready",
		enabled: true,
		hasApiKey: true,
		replyToAddress: "",
		senderAddress: "noreply@virtool.example",
		senderName: "Virtool",
		...overrides,
	};
}
