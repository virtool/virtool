import { vi } from "vitest";

/** Mock handles for recent-authentication server functions. */
export const recentAuthenticationServerFnMocks = {
	challengeRecentAuthenticationFn: vi.fn(),
	getRecentAuthenticationMethodsFn: vi.fn(),
	isRecentAuthenticationFreshFn: vi.fn(),
};
