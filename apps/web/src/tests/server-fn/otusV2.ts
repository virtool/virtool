import type { LocalOtuV2, LocalOtuV2Summary } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/otus-v2/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering a v2 OTU view can stub
 * them without per-file `vi.mock` boilerplate.
 */
export const otuV2ServerFnMocks = {
	createLocalOtuIsolateFn: vi.fn(),
	createLocalOtuFn: vi.fn(),
	deleteLocalOtuFn: vi.fn(),
	deleteLocalOtuIsolateFn: vi.fn(),
	getGenbankIsolateDraftFn: vi.fn(),
	getGenbankOtuDraftFn: vi.fn(),
	getLocalOtuFn: vi.fn(),
	getLocalOtuIsolateFn: vi.fn(),
	getLocalOtuIsolatesFn: vi.fn(),
	getLocalOtuSequenceFn: vi.fn(),
	getLocalOtusFn: vi.fn(),
	previewLocalOtuPlanFn: vi.fn(),
	updateLocalOtuPlanFn: vi.fn(),
	updateLocalOtuTaxonomyFn: vi.fn(),
};

/** Sets up deleteLocalOtu to resolve successfully. */
export function mockDeleteLocalOtuV2(): Mock {
	otuV2ServerFnMocks.deleteLocalOtuFn.mockResolvedValue(null);
	return otuV2ServerFnMocks.deleteLocalOtuFn;
}

/** Sets up deleteLocalOtuIsolate to resolve successfully. */
export function mockDeleteLocalOtuIsolateV2(otu: LocalOtuV2): Mock {
	otuV2ServerFnMocks.deleteLocalOtuIsolateFn.mockResolvedValue(otu);
	return otuV2ServerFnMocks.deleteLocalOtuIsolateFn;
}

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
				return {
					...otu,
					isolates: otu.isolates
						.slice(0, 5)
						.map(({ id, name }) => ({ id, name })),
					isolateCount: otu.isolates.length,
				};
			}
			throw new Error(`unexpected otuId in mockGetLocalOtuV2: ${data.otuId}`);
		},
	);
	otuV2ServerFnMocks.getLocalOtuIsolatesFn.mockResolvedValue(
		otu.isolates.map(({ id, name }) => ({
			id,
			name,
			createdAt: otu.createdAt,
		})),
	);
	otuV2ServerFnMocks.getLocalOtuIsolateFn.mockImplementation(
		async ({ data }: { data: { isolateId: string } }) => {
			const isolate = otu.isolates.find(({ id }) => id === data.isolateId);
			if (!isolate) {
				throw new Error(
					`unexpected isolateId in mockGetLocalOtuV2: ${data.isolateId}`,
				);
			}
			return {
				id: isolate.id,
				name: isolate.name,
				sequences: isolate.sequences.map(({ id, definition, segmentId }) => ({
					id,
					definition,
					segmentId,
				})),
			};
		},
	);
	otuV2ServerFnMocks.getLocalOtuSequenceFn.mockImplementation(
		async ({ data }: { data: { sequenceId: string } }) => {
			for (const isolate of otu.isolates) {
				const sequence = isolate.sequences.find(
					({ id }) => id === data.sequenceId,
				);
				if (sequence) {
					return sequence;
				}
			}
			throw new Error(
				`unexpected sequenceId in mockGetLocalOtuV2: ${data.sequenceId}`,
			);
		},
	);
	return otuV2ServerFnMocks.getLocalOtuFn;
}
