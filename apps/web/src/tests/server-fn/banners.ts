import { vi } from "vitest";

/**
 * Mock handles for the `@server/banners/functions` server-fn module. Wired in
 * globally from `tests/serverFnMocks.ts`, because the layout fetches the active
 * banner on every authenticated route.
 */
export const bannerServerFnMocks = {
	clearActiveBannerFn: vi.fn(),
	createBannerFn: vi.fn(),
	deleteBannerFn: vi.fn(),
	findBannerFn: vi.fn(),
	findBannersFn: vi.fn(),
	setActiveBannerFn: vi.fn(),
	updateBannerFn: vi.fn(),
};
