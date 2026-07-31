import type { Genbank, Otu, OtuIsolate, OtuSequence } from "@virtool/contracts";
import { type Mock, vi } from "vitest";
import { createFakeOtuIsolate, createFakeOtuSequence } from "../fake/otus";

/**
 * Mock handles for the `@server/otus/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test rendering a view that lists,
 * reads, or mutates OTUs, isolates, or sequences can stub them without
 * per-file `vi.mock` boilerplate.
 */
export const otuServerFnMocks = {
	findOtusFn: vi.fn(),
	getOtuFn: vi.fn(),
	listOtuHistoryFn: vi.fn(),
	createOtuFn: vi.fn(),
	updateOtuFn: vi.fn(),
	deleteOtuFn: vi.fn(),
	createIsolateFn: vi.fn(),
	updateIsolateFn: vi.fn(),
	setIsolateAsDefaultFn: vi.fn(),
	deleteIsolateFn: vi.fn(),
	createSequenceFn: vi.fn(),
	updateSequenceFn: vi.fn(),
	deleteSequenceFn: vi.fn(),
};

/**
 * Mock handles for the `@server/genbank/functions` server-fn module. Kept
 * beside the OTU mocks because the only caller is the sequence form's
 * accession auto-fill.
 */
export const genbankServerFnMocks = {
	getGenbankFn: vi.fn(),
};

/** Sets up createOtu to resolve with the given OTU. */
export function mockCreateOtu(otu: Otu): Mock {
	otuServerFnMocks.createOtuFn.mockResolvedValue(otu);
	return otuServerFnMocks.createOtuFn;
}

/** Sets up updateOtu to resolve with the given OTU. */
export function mockUpdateOtu(otu: Otu): Mock {
	otuServerFnMocks.updateOtuFn.mockResolvedValue(otu);
	return otuServerFnMocks.updateOtuFn;
}

/** Sets up deleteOtu to resolve, as the deletion answers with no content. */
export function mockDeleteOtu(): Mock {
	otuServerFnMocks.deleteOtuFn.mockResolvedValue(null);
	return otuServerFnMocks.deleteOtuFn;
}

/** Sets up createIsolate to resolve with an isolate carrying the given source. */
export function mockCreateIsolate(overrides?: Partial<OtuIsolate>): Mock {
	otuServerFnMocks.createIsolateFn.mockResolvedValue(
		createFakeOtuIsolate({ sequences: [], ...overrides }),
	);
	return otuServerFnMocks.createIsolateFn;
}

/** Sets up deleteIsolate to resolve, as the deletion answers with no content. */
export function mockDeleteIsolate(): Mock {
	otuServerFnMocks.deleteIsolateFn.mockResolvedValue(null);
	return otuServerFnMocks.deleteIsolateFn;
}

/** Sets up createSequence to resolve with a sequence carrying the given values. */
export function mockCreateSequence(overrides?: Partial<OtuSequence>): Mock {
	otuServerFnMocks.createSequenceFn.mockResolvedValue(
		createFakeOtuSequence(overrides),
	);
	return otuServerFnMocks.createSequenceFn;
}

/** Sets up updateSequence to resolve with a sequence carrying the given values. */
export function mockUpdateSequence(overrides?: Partial<OtuSequence>): Mock {
	otuServerFnMocks.updateSequenceFn.mockResolvedValue(
		createFakeOtuSequence(overrides),
	);
	return otuServerFnMocks.updateSequenceFn;
}

/** Sets up deleteSequence to resolve, as the deletion answers with no content. */
export function mockDeleteSequence(): Mock {
	otuServerFnMocks.deleteSequenceFn.mockResolvedValue(null);
	return otuServerFnMocks.deleteSequenceFn;
}

/**
 * Sets up getGenbank to resolve with the given record, or to reject with a 404
 * when `genbank` is `null` — the shape `ClientError` reaches the client with.
 */
export function mockGetGenbank(accession: string, genbank: Genbank | null) {
	genbankServerFnMocks.getGenbankFn.mockImplementation(
		async ({ data }: { data: { accession: string } }) => {
			if (data.accession !== accession) {
				throw new Error(`unexpected accession in mockGetGenbank: ${accession}`);
			}

			if (genbank === null) {
				const error = new Error("Accession not found.");
				error.name = "ClientError";
				Object.assign(error, { status: 404 });
				throw error;
			}

			return genbank;
		},
	);
	return genbankServerFnMocks.getGenbankFn;
}
