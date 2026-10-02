import type {
	AccountSecurity,
	ActiveBrowserSession,
	ApiKey,
	PasskeySummary,
	Permissions,
} from "@virtool/contracts";
import { type Mock, vi } from "vitest";
import { createFakeAccountSecurity, createFakeApiKey } from "../fake/account";

/**
 * Mock handles for the `@server/account/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering the API-key management
 * view can stub them without per-file `vi.mock` boilerplate.
 */
export const accountServerFnMocks = {
	findActiveBrowserSessionsFn: vi.fn(),
	findApiKeysFn: vi.fn(),
	createApiKeyFn: vi.fn(),
	updateApiKeyFn: vi.fn(),
	deleteApiKeyFn: vi.fn(),
	findPasskeysFn: vi.fn(),
	getAccountSecurityFn: vi.fn(),
	renamePasskeyFn: vi.fn(),
	removePasskeyFn: vi.fn(),
	revokeBrowserSessionFn: vi.fn(),
	revokeOtherBrowserSessionsFn: vi.fn(),
};

/** Sets up getAccountSecurity to resolve with the given security state. */
export function mockGetAccountSecurity(
	overrides?: Partial<AccountSecurity>,
): Mock {
	accountServerFnMocks.getAccountSecurityFn.mockResolvedValue(
		createFakeAccountSecurity(overrides),
	);
	return accountServerFnMocks.getAccountSecurityFn;
}

/** Sets up findActiveBrowserSessions to resolve with the given sessions. */
export function mockFindActiveBrowserSessions(
	sessions: ActiveBrowserSession[],
): Mock {
	accountServerFnMocks.findActiveBrowserSessionsFn.mockResolvedValue(sessions);
	return accountServerFnMocks.findActiveBrowserSessionsFn;
}

/** Sets up findPasskeys to resolve with the given passkeys. */
export function mockFindPasskeys(passkeys: PasskeySummary[]): Mock {
	accountServerFnMocks.findPasskeysFn.mockResolvedValue(passkeys);
	return accountServerFnMocks.findPasskeysFn;
}

/** Sets up findApiKeys to resolve with the given API keys. */
export function mockFindApiKeys(apiKeys: ApiKey[]): Mock {
	accountServerFnMocks.findApiKeysFn.mockResolvedValue(apiKeys);
	return accountServerFnMocks.findApiKeysFn;
}

/**
 * Sets up createApiKey to resolve with a created key carrying the given raw
 * secret and permissions.
 */
export function mockCreateApiKey(
	key: string,
	permissions: Permissions,
	overrides?: Partial<ApiKey>,
): Mock {
	accountServerFnMocks.createApiKeyFn.mockResolvedValue({
		...createFakeApiKey({ permissions, ...overrides }),
		key,
	});
	return accountServerFnMocks.createApiKeyFn;
}
