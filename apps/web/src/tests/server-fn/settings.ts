import {
	DEFAULT_MINIMUM_PASSWORD_LENGTH,
	type Settings,
} from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/settings/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` because every password form queries the
 * policy, including the unauthenticated ones.
 */
export const settingsServerFnMocks = {
	clearNcbiApiKeyFn: vi.fn(),
	getPasswordPolicyFn: vi.fn(),
	getSettingsFn: vi.fn(),
	setNcbiApiKeyFn: vi.fn(),
	updateSettingsFn: vi.fn(),
};

/** Set the minimum password length the password forms will validate against. */
export function mockGetPasswordPolicy(
	minimumPasswordLength: number = DEFAULT_MINIMUM_PASSWORD_LENGTH,
): Mock {
	settingsServerFnMocks.getPasswordPolicyFn.mockResolvedValue({
		minimumPasswordLength,
	});
	return settingsServerFnMocks.getPasswordPolicyFn;
}

/** Resolve the settings query with the given settings. */
export function mockGetSettings(settings: Settings): Mock {
	settingsServerFnMocks.getSettingsFn.mockResolvedValue(settings);
	return settingsServerFnMocks.getSettingsFn;
}

/** Resolve the settings update, echoing the given settings back to the caller. */
export function mockUpdateSettings(settings: Settings): Mock {
	settingsServerFnMocks.updateSettingsFn.mockResolvedValue(settings);
	return settingsServerFnMocks.updateSettingsFn;
}

/**
 * Wire the settings server functions against a shared, mutable settings record
 * so a read after a write reflects the change. An update merges its `data`
 * patch into the record and resolves with the merged result, and a later
 * `getSettings` returns that same record — matching how a component that
 * invalidates the settings cache refetches the patched values.
 *
 * The NCBI API key is write-only here as it is on the server: storing one only
 * flips `hasNcbiApiKey` and reports the key as usable. A test that needs
 * `configuration_error` passes it in, because availability is the server's to
 * decide.
 */
export function mockSettingsStore(initial: Settings): {
	clearNcbiApiKey: Mock;
	getSettings: Mock;
	setNcbiApiKey: Mock;
	updateSettings: Mock;
} {
	let current = initial;

	settingsServerFnMocks.getSettingsFn.mockImplementation(async () => current);
	settingsServerFnMocks.updateSettingsFn.mockImplementation(
		async ({ data }: { data: Partial<Settings> }) => {
			current = { ...current, ...data };
			return current;
		},
	);

	settingsServerFnMocks.setNcbiApiKeyFn.mockImplementation(async () => {
		current = { ...current, hasNcbiApiKey: true, ncbiAvailability: "ready" };
		return current;
	});

	settingsServerFnMocks.clearNcbiApiKeyFn.mockImplementation(async () => {
		current = {
			...current,
			hasNcbiApiKey: false,
			ncbiAvailability: "unconfigured",
		};
		return current;
	});

	return {
		clearNcbiApiKey: settingsServerFnMocks.clearNcbiApiKeyFn,
		getSettings: settingsServerFnMocks.getSettingsFn,
		setNcbiApiKey: settingsServerFnMocks.setNcbiApiKeyFn,
		updateSettings: settingsServerFnMocks.updateSettingsFn,
	};
}
