import type { ReferenceV2 } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/references-v2/functions` server-fn module. Wired
 * in globally from `tests/setup.tsx` so any test rendering a v2 Reference view
 * can stub them without per-file `vi.mock` boilerplate.
 */
export const referenceV2ServerFnMocks = {
	createReferenceV2Fn: vi.fn(),
	getReferenceV2Fn: vi.fn(),
	getReferencesV2Fn: vi.fn(),
};

/** Sets up the v2 Reference list to resolve with the given References. */
export function mockGetReferencesV2(references: ReferenceV2[]): Mock {
	referenceV2ServerFnMocks.getReferencesV2Fn.mockResolvedValue(references);
	return referenceV2ServerFnMocks.getReferencesV2Fn;
}

/** Sets up getReferenceV2 to resolve with the given Reference when matched. */
export function mockGetReferenceV2(reference: ReferenceV2): Mock {
	referenceV2ServerFnMocks.getReferenceV2Fn.mockImplementation(
		async ({ data }: { data: { referenceId: string } }) => {
			if (data.referenceId === reference.id) {
				return reference;
			}
			throw new Error(
				`unexpected referenceId in mockGetReferenceV2: ${data.referenceId}`,
			);
		},
	);
	return referenceV2ServerFnMocks.getReferenceV2Fn;
}

/** Sets up createReferenceV2 to resolve with the given Reference. */
export function mockCreateReferenceV2(reference: ReferenceV2): Mock {
	referenceV2ServerFnMocks.createReferenceV2Fn.mockResolvedValue(reference);
	return referenceV2ServerFnMocks.createReferenceV2Fn;
}
