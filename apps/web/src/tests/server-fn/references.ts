import type { Reference, ReferenceMinimal } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/references/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering a view that lists, reads,
 * or mutates references can stub them without per-file `vi.mock` boilerplate.
 */
export const referenceServerFnMocks = {
	findReferencesFn: vi.fn(),
	getReferenceFn: vi.fn(),
	createReferenceFn: vi.fn(),
	updateReferenceFn: vi.fn(),
	archiveReferenceFn: vi.fn(),
	unarchiveReferenceFn: vi.fn(),
	addReferenceUserFn: vi.fn(),
	addReferenceGroupFn: vi.fn(),
	updateReferenceUserFn: vi.fn(),
	updateReferenceGroupFn: vi.fn(),
	removeReferenceUserFn: vi.fn(),
	removeReferenceGroupFn: vi.fn(),
};

/** Sets up findReferences to resolve with a single page of the given items. */
export function mockFindReferences(
	items: ReferenceMinimal[],
	overrides?: Partial<{ foundCount: number; totalCount: number }>,
): Mock {
	referenceServerFnMocks.findReferencesFn.mockResolvedValue({
		foundCount: items.length,
		totalCount: items.length,
		page: 1,
		pageCount: 1,
		perPage: 25,
		items,
		...overrides,
	});
	return referenceServerFnMocks.findReferencesFn;
}

/** Sets up getReference to resolve with the given reference when matched. */
export function mockGetReference(reference: Reference): Mock {
	referenceServerFnMocks.getReferenceFn.mockImplementation(
		async ({ data }: { data: { referenceId: number } }) => {
			if (data.referenceId === reference.id) {
				return reference;
			}
			throw new Error(
				`unexpected referenceId in mockGetReference: ${data.referenceId}`,
			);
		},
	);
	return referenceServerFnMocks.getReferenceFn;
}

/** Sets up createReference to resolve with the given reference. */
export function mockCreateReference(reference: Reference): Mock {
	referenceServerFnMocks.createReferenceFn.mockResolvedValue(reference);
	return referenceServerFnMocks.createReferenceFn;
}

/** Sets up archiveReference to resolve with the given reference. */
export function mockArchiveReference(reference: Reference): Mock {
	referenceServerFnMocks.archiveReferenceFn.mockResolvedValue(reference);
	return referenceServerFnMocks.archiveReferenceFn;
}

/** Sets up unarchiveReference to resolve with the given reference. */
export function mockUnarchiveReference(reference: Reference): Mock {
	referenceServerFnMocks.unarchiveReferenceFn.mockResolvedValue(reference);
	return referenceServerFnMocks.unarchiveReferenceFn;
}
