import type { LocalOtuV2, LocalOtuV2Summary } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/otus-v2/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering a v2 OTU view can stub
 * them without per-file `vi.mock` boilerplate.
 */
export const otuV2ServerFnMocks = {
	createLocalOtuFn: vi.fn(),
	getLocalOtuFn: vi.fn(),
	getLocalOtusFn: vi.fn(),
};

/** Sets up getLocalOtus to resolve with the given OTU summaries. */
export function mockGetLocalOtusV2(otus: LocalOtuV2Summary[]): Mock {
	otuV2ServerFnMocks.getLocalOtusFn.mockResolvedValue(otus);
	return otuV2ServerFnMocks.getLocalOtusFn;
}

/** Sets up getLocalOtu to resolve with the given OTU when matched. */
export function mockGetLocalOtuV2(otu: LocalOtuV2): Mock {
	otuV2ServerFnMocks.getLocalOtuFn.mockImplementation(
		async ({ data }: { data: { referenceId: string; otuId: string } }) => {
			if (data.otuId === otu.id) {
				return otu;
			}
			throw new Error(`unexpected otuId in mockGetLocalOtuV2: ${data.otuId}`);
		},
	);
	return otuV2ServerFnMocks.getLocalOtuFn;
}

/** Sets up createLocalOtu to resolve with the given OTU. */
export function mockCreateLocalOtuV2(otu: LocalOtuV2): Mock {
	otuV2ServerFnMocks.createLocalOtuFn.mockResolvedValue(otu);
	return otuV2ServerFnMocks.createLocalOtuFn;
}
