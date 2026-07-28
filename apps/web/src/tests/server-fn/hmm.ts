import type { Hmm, HmmSearchResult } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/hmm/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering an HMM view can stub
 * these without per-file `vi.mock` boilerplate.
 */
export const hmmServerFnMocks = {
	findHmmsFn: vi.fn(),
	getHmmFn: vi.fn(),
	installHmmFn: vi.fn(),
};

/** Sets up findHmms to resolve with the given search results. */
export function mockFindHmms(searchResults: HmmSearchResult): Mock {
	hmmServerFnMocks.findHmmsFn.mockResolvedValue(searchResults);
	return hmmServerFnMocks.findHmmsFn;
}

/** Sets up getHmm to resolve with the given HMM. */
export function mockGetHmm(hmm: Hmm): Mock {
	hmmServerFnMocks.getHmmFn.mockResolvedValue(hmm);
	return hmmServerFnMocks.getHmmFn;
}

/**
 * Sets up getHmm to reject with an error carrying the given HTTP status, the way
 * a server function surfaces a 404 to the client.
 */
export function mockGetHmmError(status: number): Mock {
	hmmServerFnMocks.getHmmFn.mockRejectedValue(
		Object.assign(new Error("HMM not found."), { status }),
	);
	return hmmServerFnMocks.getHmmFn;
}
