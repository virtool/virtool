import type {
	Index,
	IndexMinimal,
	IndexSearchResult,
	UnbuiltChangesSearchResult,
} from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/indexes/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering an index view — or the
 * analysis-creation dialog, which offers the ready ones — can stub these without
 * per-file `vi.mock` boilerplate.
 */
export const indexServerFnMocks = {
	findIndexesFn: vi.fn(),
	listReadyIndexesFn: vi.fn(),
	getIndexFn: vi.fn(),
	findUnbuiltChangesFn: vi.fn(),
	createIndexFn: vi.fn(),
};

/** Sets up findIndexes to resolve with a single page of the given items. */
export function mockFindIndexes(
	items: IndexMinimal[],
	overrides?: Partial<IndexSearchResult>,
): Mock {
	indexServerFnMocks.findIndexesFn.mockResolvedValue({
		foundCount: items.length,
		totalCount: items.length,
		page: 1,
		pageCount: 1,
		perPage: 25,
		items,
		changeCount: 0,
		modifiedOtuCount: 0,
		totalOtuCount: items.length,
		...overrides,
	});
	return indexServerFnMocks.findIndexesFn;
}

/** Sets up listReadyIndexes to resolve with the given indexes. */
export function mockListReadyIndexes(indexes: IndexMinimal[]): Mock {
	indexServerFnMocks.listReadyIndexesFn.mockResolvedValue(indexes);
	return indexServerFnMocks.listReadyIndexesFn;
}

/** Sets up getIndex to resolve with the given index. */
export function mockGetIndex(index: Index): Mock {
	indexServerFnMocks.getIndexFn.mockResolvedValue(index);
	return indexServerFnMocks.getIndexFn;
}

/** Sets up findUnbuiltChanges to resolve with a single page of the given changes. */
export function mockFindUnbuiltChanges(
	items: UnbuiltChangesSearchResult["items"],
	overrides?: Partial<UnbuiltChangesSearchResult>,
): Mock {
	indexServerFnMocks.findUnbuiltChangesFn.mockResolvedValue({
		foundCount: items.length,
		totalCount: items.length,
		page: 1,
		pageCount: 1,
		perPage: 25,
		items,
		...overrides,
	});
	return indexServerFnMocks.findUnbuiltChangesFn;
}

/** Sets up createIndex to resolve with the index a build would have inserted. */
export function mockCreateIndex(index: Index): Mock {
	indexServerFnMocks.createIndexFn.mockResolvedValue(index);
	return indexServerFnMocks.createIndexFn;
}
