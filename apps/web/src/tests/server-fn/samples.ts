import type { GroupMinimal, Sample, SampleMinimal } from "@virtool/contracts";
import { type Mock, vi } from "vitest";
import { createFakeSample } from "../fake/samples";

/**
 * Mock handles for the `@server/samples/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test importing this helper can stub the
 * sample server functions without per-file `vi.mock` boilerplate.
 */
export const sampleServerFnMocks = {
	findSamplesFn: vi.fn(),
	findRecentlyViewedSamplesFn: vi.fn(),
	getSampleFn: vi.fn(),
	recordSampleViewFn: vi.fn(),
	createSampleFn: vi.fn(),
	updateSampleFn: vi.fn(),
	deleteSampleFn: vi.fn(),
	updateSampleRightsFn: vi.fn(),
	listSampleGroupsFn: vi.fn(),
};

/**
 * Sets up findSamples to resolve with a single page of the given samples.
 *
 * @param samples - the samples on the page
 * @param counts - overrides for the counts, which otherwise both match the
 *   number of samples. `totalCount` is every sample the user may see and
 *   `foundCount` is only those matching the filters.
 */
export function mockFindSamples(
	samples: SampleMinimal[],
	counts: { foundCount?: number; totalCount?: number } = {},
): Mock {
	sampleServerFnMocks.findSamplesFn.mockResolvedValue({
		page: 1,
		pageCount: 1,
		perPage: 5,
		totalCount: counts.totalCount ?? samples.length,
		foundCount: counts.foundCount ?? samples.length,
		items: samples,
	});
	return sampleServerFnMocks.findSamplesFn;
}

/**
 * Sets up findRecentlyViewedSamples to resolve with a single page of the given
 * samples.
 *
 * @param samples - the samples on the page, newest-viewed first
 * @param counts - overrides for the counts, which otherwise both match the
 *   number of samples
 */
export function mockFindRecentlyViewedSamples(
	samples: SampleMinimal[],
	counts: { foundCount?: number; totalCount?: number } = {},
): Mock {
	sampleServerFnMocks.findRecentlyViewedSamplesFn.mockResolvedValue({
		page: 1,
		pageCount: 1,
		perPage: 10,
		totalCount: counts.totalCount ?? samples.length,
		foundCount: counts.foundCount ?? samples.length,
		items: samples,
	});
	return sampleServerFnMocks.findRecentlyViewedSamplesFn;
}

/**
 * Sets up findSamples to serve one page per entry in `pages`, selecting by the
 * requested `page`, so a selection made on one page can be asserted from
 * another.
 *
 * @param pages - the samples on each page, in page order
 */
export function mockFindSamplePages(pages: SampleMinimal[][]): Mock {
	sampleServerFnMocks.findSamplesFn.mockImplementation(
		async ({ data }: { data?: { page?: number } }) => {
			const page = data?.page ?? 1;
			return {
				page,
				pageCount: pages.length,
				perPage: 1,
				totalCount: pages.length,
				foundCount: pages.length,
				items: pages[page - 1] ?? [],
			};
		},
	);
	return sampleServerFnMocks.findSamplesFn;
}

/** Sets up listSampleGroups to resolve with the given groups. */
export function mockListSampleGroups(groups: GroupMinimal[] = []): Mock {
	sampleServerFnMocks.listSampleGroupsFn.mockResolvedValue(groups);
	return sampleServerFnMocks.listSampleGroupsFn;
}

/** Sets up getSample to resolve with the given sample. */
export function mockGetSample(sample: Sample): Mock {
	sampleServerFnMocks.getSampleFn.mockResolvedValue(sample);
	return sampleServerFnMocks.getSampleFn;
}

/** Sets up createSample to resolve with the given (or a fake) sample. */
export function mockCreateSample(sample?: Sample): Mock {
	sampleServerFnMocks.createSampleFn.mockResolvedValue(
		sample ?? createFakeSample(),
	);
	return sampleServerFnMocks.createSampleFn;
}

/** Sets up updateSample to resolve with the given sample, patched with the fields. */
export function mockUpdateSample(
	sample: Sample,
	update: Partial<Sample> = {},
): Mock {
	sampleServerFnMocks.updateSampleFn.mockResolvedValue({
		...sample,
		...update,
	});
	return sampleServerFnMocks.updateSampleFn;
}

/** Sets up deleteSample to resolve. */
export function mockDeleteSample(): Mock {
	sampleServerFnMocks.deleteSampleFn.mockResolvedValue(null);
	return sampleServerFnMocks.deleteSampleFn;
}

/** Sets up updateSampleRights to resolve with the given sample, patched with the fields. */
export function mockUpdateSampleRights(
	sample: Sample,
	update: Partial<Sample> = {},
): Mock {
	sampleServerFnMocks.updateSampleRightsFn.mockResolvedValue({
		...sample,
		...update,
	});
	return sampleServerFnMocks.updateSampleRightsFn;
}
