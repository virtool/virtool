import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/root/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so route-level tests can stub the
 * unauthenticated root document without per-file `vi.mock` boilerplate.
 */
export const rootServerFnMocks = {
	getRootFn: vi.fn(),
};

/**
 * Sets up getRoot to resolve with the given root document. `version` defaults to
 * the build version so callers that only care about `firstUser` can omit it.
 */
export function mockGetRoot(root: {
	firstUser: boolean;
	version?: string;
}): Mock {
	rootServerFnMocks.getRootFn.mockResolvedValue({
		version: __APP_VERSION__,
		...root,
	});
	return rootServerFnMocks.getRootFn;
}
