import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import {
	useSortAndFilterNuVsHits,
	useSortAndFilterPathoscopeHits,
} from "@analyses/hooks";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import type {
	FormattedNuvsAnalysis,
	FormattedNuvsHit,
	FormattedPathoscopeAnalysis,
} from "@analyses/types";
import { renderHook } from "@testing-library/react";
import { createFakePathoscopeHit } from "@tests/fake/analyses";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Three hits whose name, coverage, depth and weight each rank them differently,
// so a sort that reads the wrong field cannot accidentally produce the right
// order. Only one name is capitalised out of alphabetical order, so a raw
// codepoint comparison ranks them differently again.
const hits = [
	createFakePathoscopeHit({
		id: "a",
		name: "adenovirus",
		coverage: 0.1,
		depth: 30,
		pi: 0.5,
	}),
	createFakePathoscopeHit({
		id: "b",
		name: "Betaflexivirus",
		coverage: 0.9,
		depth: 10,
		pi: 0.2,
	}),
	createFakePathoscopeHit({
		id: "c",
		name: "Cucumovirus",
		coverage: 0.5,
		depth: 20,
		pi: 0.9,
	}),
];

function createWrapper(search: Partial<AnalysisSearch>) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<AnalysisSearchProvider
				search={{ ...DEFAULT_ANALYSIS_SEARCH, ...search }}
				setSearch={vi.fn()}
			>
				{children}
			</AnalysisSearchProvider>
		);
	};
}

// `dir` always has a value on a real route — the URL only ever narrows the
// default — so passing none here means the default, not `undefined`.
function renderSort(
	sort?: string,
	dir: "asc" | "desc" = DEFAULT_ANALYSIS_SEARCH.dir,
) {
	const analysis = {
		results: { hits, readCount: 1000, subtractedCount: 0 },
	} as FormattedPathoscopeAnalysis;

	const { result } = renderHook(
		() => useSortAndFilterPathoscopeHits(analysis),
		{
			// Sorting only, so nothing is held back by the coverage filter the
			// viewer opens with.
			wrapper: createWrapper({ sort, dir, showLowOtus: true }),
		},
	);

	return result.current.map((hit) => hit.id);
}

describe("useSortAndFilterPathoscopeHits()", () => {
	it("should sort by weight, which is the hit's pi", () => {
		// The toolbar labels `pi` "Weight" and puts that word in the URL, so the
		// key it emits is not a field on the hit.
		expect(renderSort("weight", "asc")).toEqual(["b", "a", "c"]);
		expect(renderSort("weight", "desc")).toEqual(["c", "a", "b"]);
	});

	it("should sort by coverage", () => {
		expect(renderSort("coverage", "asc")).toEqual(["a", "c", "b"]);
	});

	it("should sort by depth", () => {
		expect(renderSort("depth", "asc")).toEqual(["b", "c", "a"]);
	});

	it("should sort by name, ignoring case", () => {
		// A raw codepoint comparison would rank "adenovirus" behind every
		// capitalised name, giving ["b", "c", "a"] ascending.
		expect(renderSort("name", "asc")).toEqual(["a", "b", "c"]);
		expect(renderSort("name", "desc")).toEqual(["c", "b", "a"]);
	});

	it("should default to coverage, descending, when nothing has been chosen", () => {
		// A freshly-opened analysis should lead with its strongest hits.
		expect(renderSort()).toEqual(["b", "c", "a"]);
	});

	// The switch that turns this off draws itself pressed on an untouched URL,
	// so an untouched URL has to filter — the two read one resolved param now
	// rather than defaulting apart.
	it("should hold hits to the cutoff when the URL says nothing", () => {
		const analysis = {
			results: { hits, readCount: 1000, subtractedCount: 0 },
		} as FormattedPathoscopeAnalysis;

		const { result } = renderHook(
			() => useSortAndFilterPathoscopeHits(analysis),
			{ wrapper: createWrapper({}) },
		);

		// Only "a", at 0.1 coverage, is under the 0.5 default.
		expect(result.current.map((hit) => hit.id)).toEqual(["b", "c"]);
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

function renderNuvs(
	search: Partial<AnalysisSearch>,
	hits: FormattedNuvsHit[] = nuvsHits,
) {
	const analysis = {
		results: { hits, maxSequenceLength: 4 },
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
		expect(renderNuvs({}).toSorted()).toEqual([1, 2]);
	});

	it("should keep unannotated contigs when not filtering", () => {
		expect(renderNuvs({ showUnhitSequences: true }).toSorted()).toEqual([
			1, 2, 3,
		]);
	});

	it("should sort by e-value, lowest first", () => {
		expect(renderNuvs({ sort: "e" })).toEqual([2, 1]);
	});

	it("should sort by annotated ORF count, highest first", () => {
		expect(renderNuvs({ showUnhitSequences: true, sort: "orfs" })).toEqual([
			2, 3, 1,
		]);
	});

	// A contig's length is the length of its own sequence. A hit carries no
	// `length` field, so reading the key off the hit ranked every contig by
	// `undefined` and left the list in the workflow's output order — while the
	// toolbar reported it was sorted by length.
	it("should sort by contig length, longest first", () => {
		const byLength = [
			createNuvsHit({ id: 1, e: 0.5, sequence: "AT" }),
			createNuvsHit({ id: 2, e: 0.5, sequence: "ATGCAT" }),
			createNuvsHit({ id: 3, e: 0.5, sequence: "ATGC" }),
		];

		expect(renderNuvs({ sort: "length" }, byLength)).toEqual([2, 3, 1]);
	});

	it("should sort by contig length by default", () => {
		const byLength = [
			createNuvsHit({ id: 1, e: 0.5, sequence: "AT" }),
			createNuvsHit({ id: 2, e: 0.5, sequence: "ATGCAT" }),
		];

		expect(renderNuvs({}, byLength)).toEqual([2, 1]);
	});

	// The absence of a hit, not the strongest one — `null` would otherwise lead
	// the list it belongs at the end of.
	it("should rank a contig with no e-value last", () => {
		expect(renderNuvs({ showUnhitSequences: true, sort: "e" })).toEqual([
			2, 1, 3,
		]);
	});
});
