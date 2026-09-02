import type { EmailSettings } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/** Mock handles for the `@server/email/functions` server-fn module. */
export const emailServerFnMocks = {
	clearEmailApiKeyFn: vi.fn(),
	getEmailSettingsFn: vi.fn(),
	sendTestEmailFn: vi.fn(),
	setEmailApiKeyFn: vi.fn(),
	updateEmailSettingsFn: vi.fn(),
};

/**
 * Wire the email server functions against a shared, mutable configuration so a
 * read after a write reflects the change.
 *
 * `availability` is the server's to decide, so a test that needs a particular
 * state passes it in rather than expecting the store to derive one. The API key
 * is write-only here as it is on the server: storing one only flips
 * `hasApiKey`.
 */
export function mockEmailSettingsStore(initial: EmailSettings): {
	clearEmailApiKey: Mock;
	getEmailSettings: Mock;
	setEmailApiKey: Mock;
	updateEmailSettings: Mock;
} {
	let current = initial;

	emailServerFnMocks.getEmailSettingsFn.mockImplementation(async () => current);

	emailServerFnMocks.updateEmailSettingsFn.mockImplementation(
		async ({ data }: { data: Partial<EmailSettings> }) => {
			current = { ...current, ...data };
			return current;
		},
	);

	emailServerFnMocks.setEmailApiKeyFn.mockImplementation(async () => {
		current = { ...current, hasApiKey: true };
		return current;
	});

	emailServerFnMocks.clearEmailApiKeyFn.mockImplementation(async () => {
		current = {
			...current,
			availability: "unconfigured",
			enabled: false,
			hasApiKey: false,
		};
		return current;
	});

	return {
		clearEmailApiKey: emailServerFnMocks.clearEmailApiKeyFn,
		getEmailSettings: emailServerFnMocks.getEmailSettingsFn,
		setEmailApiKey: emailServerFnMocks.setEmailApiKeyFn,
		updateEmailSettings: emailServerFnMocks.updateEmailSettingsFn,
	};
}
