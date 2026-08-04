import type { Settings } from "@administration/types";
import { DEFAULT_MINIMUM_PASSWORD_LENGTH } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/settings/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` because every password form queries the
 * policy, including the unauthenticated ones.
 */
export const settingsServerFnMocks = {
	getPasswordPolicyFn: vi.fn(),
	getSettingsFn: vi.fn(),
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
 * Wire `getSettings` and `updateSettings` against a shared, mutable settings
 * record so a read after a write reflects the change. An update merges its
 * `data` patch into the record and resolves with the merged result, and a later
 * `getSettings` returns that same record — matching how a component that
 * invalidates the settings cache refetches the patched values.
 */
export function mockSettingsStore(initial: Settings): {
	getSettings: Mock;
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

	return {
		getSettings: settingsServerFnMocks.getSettingsFn,
		updateSettings: settingsServerFnMocks.updateSettingsFn,
	};
}
