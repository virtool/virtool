import type {
	Subtraction,
	SubtractionMinimal,
	SubtractionNested,
} from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/subtraction/functions` server-fn module. Wired
 * in globally from `tests/setup.tsx` so any test rendering a view that lists or
 * reads subtractions can stub them without per-file `vi.mock` boilerplate.
 */
export const subtractionServerFnMocks = {
	createSubtractionFn: vi.fn(),
	deleteSubtractionFn: vi.fn(),
	findSubtractionsFn: vi.fn(),
	getSubtractionFn: vi.fn(),
	listSubtractionsShortlistFn: vi.fn(),
	updateSubtractionFn: vi.fn(),
};

/** Sets up findSubtractions to resolve with a single page of the given items. */
export function mockFindSubtractions(items: SubtractionMinimal[]): Mock {
	subtractionServerFnMocks.findSubtractionsFn.mockResolvedValue({
		foundCount: items.length,
		totalCount: items.length,
		readyCount: items.filter((item) => item.ready).length,
		page: 1,
		pageCount: 1,
		perPage: 25,
		items,
	});
	return subtractionServerFnMocks.findSubtractionsFn;
}

/** Sets up getSubtraction to resolve with the given subtraction when matched. */
export function mockGetSubtraction(subtraction: Subtraction): Mock {
	subtractionServerFnMocks.getSubtractionFn.mockImplementation(
		async ({ data }: { data: { subtractionId: number } }) => {
			if (data.subtractionId === subtraction.id) {
				return subtraction;
			}
			throw new Error(
				`unexpected subtractionId in mockGetSubtraction: ${data.subtractionId}`,
			);
		},
	);
	return subtractionServerFnMocks.getSubtractionFn;
}

/** Sets up createSubtraction to resolve with the given subtraction. */
export function mockCreateSubtraction(subtraction: Subtraction): Mock {
	subtractionServerFnMocks.createSubtractionFn.mockResolvedValue(subtraction);
	return subtractionServerFnMocks.createSubtractionFn;
}

/**
 * Sets up updateSubtraction to resolve with the given subtraction, patched with
 * whatever name and nickname the caller submitted.
 */
export function mockUpdateSubtraction(subtraction: Subtraction): Mock {
	subtractionServerFnMocks.updateSubtractionFn.mockImplementation(
		async ({
			data,
		}: {
			data: { subtractionId: number; name?: string; nickname?: string };
		}) => ({
			...subtraction,
			name: data.name ?? subtraction.name,
			nickname: data.nickname ?? subtraction.nickname,
		}),
	);
	return subtractionServerFnMocks.updateSubtractionFn;
}

/** Sets up deleteSubtraction to resolve. */
export function mockDeleteSubtraction(): Mock {
	subtractionServerFnMocks.deleteSubtractionFn.mockResolvedValue(null);
	return subtractionServerFnMocks.deleteSubtractionFn;
}

/** Sets up listSubtractionsShortlist to resolve with the given subtractions. */
export function mockListSubtractionsShortlist(
	subtractions: SubtractionNested[],
): Mock {
	subtractionServerFnMocks.listSubtractionsShortlistFn.mockResolvedValue(
		subtractions,
	);
	return subtractionServerFnMocks.listSubtractionsShortlistFn;
}
