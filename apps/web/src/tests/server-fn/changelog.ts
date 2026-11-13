import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/changelog/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` because every authenticated page renders the
 * nav, which can mark the changelog seen.
 */
export const changelogServerFnMocks = {
	markChangelogSeenFn: vi.fn(),
};

/** Sets up markChangelogSeen to resolve. */
export function mockMarkChangelogSeen(): Mock {
	changelogServerFnMocks.markChangelogSeenFn.mockResolvedValue(null);
	return changelogServerFnMocks.markChangelogSeenFn;
}
