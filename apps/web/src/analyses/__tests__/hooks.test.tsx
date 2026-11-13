import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import {
	useSortAndFilterNuvsHits,
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

describe("useSortAndFilterPathoscopeHits()", () => {
	it("should apply the search from context", () => {
		const analysis = {
			results: {
				hits: [
					createFakePathoscopeHit({ id: "a", name: "adenovirus" }),
					createFakePathoscopeHit({ id: "b", name: "Betaflexivirus" }),
				],
				readCount: 1000,
				subtractedCount: 0,
			},
		} as FormattedPathoscopeAnalysis;

		const { result } = renderHook(
			() => useSortAndFilterPathoscopeHits(analysis),
			{ wrapper: createWrapper({ sort: "name", dir: "desc" }) },
		);

		expect(result.current.map((hit) => hit.id)).toEqual(["b", "a"]);
	});
});

describe("useSortAndFilterNuvsHits()", () => {
	it("should apply the search from context", () => {
		const base = {
			annotatedOrfCount: 0,
			blast: null,
			families: [],
			index: 0,
			orfs: [],
			sequence: "ATGC",
		};
		const hits: FormattedNuvsHit[] = [
			{ ...base, id: 1, e: 0.5, names: ["Capsid protein"] },
			{ ...base, id: 2, e: 0, names: ["Replicase"] },
		];
		const analysis = {
			results: { hits, maxSequenceLength: 4 },
		} as FormattedNuvsAnalysis;

		const { result } = renderHook(() => useSortAndFilterNuvsHits(analysis), {
			wrapper: createWrapper({ find: "Replicase" }),
		});

		expect(result.current.map((hit) => hit.id)).toEqual([2]);
	});
});
