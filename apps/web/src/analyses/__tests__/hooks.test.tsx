import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import {
	useSortAndFilterNuVsHits,
	useSortAndFilterPathoscopeHits,
} from "@analyses/hooks";
import type {
	FormattedNuvsAnalysis,
	FormattedNuvsHit,
	FormattedPathoscopeAnalysis,
} from "@analyses/types";
import { renderHook } from "@testing-library/react";
import type { PathoscopeHit } from "@virtool/contracts";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function createHit(overrides: Partial<PathoscopeHit>): PathoscopeHit {
	return {
		abbreviation: "",
		align: [],
		coverage: 0,
		depth: 0,
		id: "otu",
		isolates: [],
		length: 100,
		maxDepth: 0,
		maxGenomeLength: 100,
		name: "OTU",
		pi: 0,
		version: 1,
		...overrides,
	};
}

// Three hits whose coverage, depth and weight each rank them differently, so a
// sort that reads the wrong field cannot accidentally produce the right order.
const hits = [
	createHit({ id: "a", name: "A", coverage: 0.1, depth: 30, pi: 0.5 }),
	createHit({ id: "b", name: "B", coverage: 0.9, depth: 10, pi: 0.2 }),
	createHit({ id: "c", name: "C", coverage: 0.5, depth: 20, pi: 0.9 }),
];

type Search = {
	filterSequences?: boolean;
	find?: string;
	sort?: string;
	sortDesc?: boolean;
};

function createWrapper(search: Search) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<AnalysisSearchProvider search={search} setSearch={vi.fn()}>
				{children}
			</AnalysisSearchProvider>
		);
	};
}

function renderSort(sort?: string, sortDesc?: boolean) {
	const analysis = {
		results: { hits, readCount: 1000, subtractedCount: 0 },
	} as FormattedPathoscopeAnalysis;

	// A read length of zero would make the OTU filter's threshold infinite, so
	// pass a realistic one. `filterOtus` is off here regardless.
	const { result } = renderHook(
		() => useSortAndFilterPathoscopeHits(analysis, 150),
		{ wrapper: createWrapper({ sort, sortDesc }) },
	);

	return result.current.map((hit) => hit.id);
}

describe("useSortAndFilterPathoscopeHits()", () => {
	it("should sort by weight, which is the hit's pi", () => {
		// The toolbar labels `pi` "Weight" and puts that word in the URL, so the
		// key it emits is not a field on the hit.
		expect(renderSort("weight")).toEqual(["b", "a", "c"]);
		expect(renderSort("weight", true)).toEqual(["c", "a", "b"]);
	});

	it("should sort by coverage", () => {
		expect(renderSort("coverage")).toEqual(["a", "c", "b"]);
	});

	it("should sort by depth", () => {
		expect(renderSort("depth")).toEqual(["b", "c", "a"]);
	});

	it("should sort by coverage when no key has been chosen", () => {
		// The toolbar shows Coverage as the default, so an untouched list has to be
		// in the order it claims.
		expect(renderSort(undefined, true)).toEqual(["b", "c", "a"]);
	});
});

function createNuvsHit(overrides: Partial<FormattedNuvsHit>): FormattedNuvsHit {
	return {
		annotatedOrfCount: 0,
		blast: null,
		e: null,
		families: [],
		id: 0,
		index: 0,
		names: [],
		orfs: [],
		sequence: "ATGC",
		...overrides,
	};
}

// The server now derives `names`, `families` and `e` from the contig's ORF hits,
// so these are the shaped values the hook is handed.
const nuvsHits = [
	createNuvsHit({
		id: 1,
		annotatedOrfCount: 1,
		e: 0.5,
		families: ["Alphaflexiviridae"],
		names: ["Capsid protein"],
	}),
	createNuvsHit({
		id: 2,
		annotatedOrfCount: 3,
		e: 0,
		families: ["Rhabdoviridae"],
		names: ["Replicase"],
	}),
	createNuvsHit({
		id: 3,
		annotatedOrfCount: 2,
		e: null,
		families: [],
		names: [],
	}),
];

function renderNuvs(search: Search) {
	const analysis = {
		results: { hits: nuvsHits, maxSequenceLength: 4 },
	} as FormattedNuvsAnalysis;

	const { result } = renderHook(() => useSortAndFilterNuVsHits(analysis), {
		wrapper: createWrapper(search),
	});

	return result.current.map((hit) => hit.id);
}

describe("useSortAndFilterNuVsHits()", () => {
	it("should search the annotation names the server derived", () => {
		// The names are a list on the shaped hit; the field the search used to read
		// was `name`, which no hit carries.
		expect(renderNuvs({ find: "Replicase" })).toEqual([2]);
	});

	it("should search families", () => {
		expect(renderNuvs({ find: "Alphaflexiviridae" })).toEqual([1]);
	});

	it("should hide only the contigs with no e-value when filtering", () => {
		// An e-value of zero is the strongest hit there is, so a filter that tests
		// for truthiness rather than for null would drop the best contig.
		expect(renderNuvs({ filterSequences: true }).toSorted()).toEqual([1, 2]);
	});

	it("should keep unannotated contigs when not filtering", () => {
		expect(renderNuvs({ filterSequences: false }).toSorted()).toEqual([
			1, 2, 3,
		]);
	});

	it("should sort by e-value, lowest first", () => {
		expect(renderNuvs({ filterSequences: true, sort: "e" })).toEqual([2, 1]);
	});

	it("should sort by annotated ORF count, highest first", () => {
		expect(renderNuvs({ sort: "orfs" })).toEqual([2, 3, 1]);
	});
});
