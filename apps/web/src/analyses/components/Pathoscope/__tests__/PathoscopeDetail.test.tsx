import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import type { PathoscopeHit, PathoscopeIsolate } from "@virtool/contracts";
import { describe, expect, it, vi } from "vitest";
import PathoscopeDetailComponent from "../PathoscopeDetail";

function createIsolate(
	name: string,
	coverage: number,
	pi: number,
): PathoscopeIsolate {
	return {
		absentSegmentKeys: [],
		coverage,
		depth: 5,
		id: name,
		length: 1000,
		name,
		pi,
		sequences: [],
	};
}

// The well-covered isolate carries the smaller share of the OTU's weight, so a
// filter reading weight rather than coverage keeps the wrong one.
const hit = {
	coverage: 0.9,
	id: "otu",
	isolates: [
		createIsolate("Covered", 0.9, 0.02),
		createIsolate("Sparse", 0.1, 0.98),
	],
	maxDepth: 40,
	pi: 1,
	segments: [],
} as unknown as PathoscopeHit;

// A segmented OTU whose one isolate was hit on neither segment. Nothing in
// `sequences` distinguishes the two panels, so `absentSegmentKeys` is the only
// thing that can — which is what makes this a test of the wiring.
const segmentedHit = {
	coverage: 0.9,
	id: "otu",
	isolates: [
		{ ...createIsolate("Segmented", 0.9, 0.5), absentSegmentKeys: ["seg:M"] },
	],
	maxDepth: 40,
	pi: 1,
	segments: [
		{ align: [], detected: true, key: "seg:L", length: 8900, name: "L" },
		{ align: [], detected: true, key: "seg:M", length: 4800, name: "M" },
	],
} as unknown as PathoscopeHit;

function renderDetail(search: Partial<AnalysisSearch> = {}) {
	renderWithProviders(
		<AnalysisSearchProvider
			search={{ ...DEFAULT_ANALYSIS_SEARCH, ...search }}
			setSearch={vi.fn()}
		>
			<PathoscopeDetailComponent hit={hit} mappedCount={1000} />
		</AnalysisSearchProvider>,
	);
}

describe("<PathoscopeDetail />", () => {
	it.each<[string, Partial<AnalysisSearch>, string[], string[]]>([
		[
			"show every isolate when the URL says nothing",
			{},
			["Covered", "Sparse"],
			[],
		],
		[
			"hide isolates under the coverage cutoff once the filter is on",
			{ showLowIsolates: false },
			["Covered"],
			["Sparse"],
		],
		[
			"hold isolates to the cutoff the search carries",
			{ minCoverage: 0.95, showLowIsolates: false },
			[],
			["Covered", "Sparse"],
		],
	])("should %s", (_, search, shown, hidden) => {
		renderDetail(search);

		for (const name of shown) {
			expect(screen.getByText(name)).toBeInTheDocument();
		}

		for (const name of hidden) {
			expect(screen.queryByText(name)).not.toBeInTheDocument();
		}
	});

	it("should tell each isolate which of the otu's segments it does not carry", () => {
		renderWithProviders(
			<AnalysisSearchProvider
				search={DEFAULT_ANALYSIS_SEARCH}
				setSearch={vi.fn()}
			>
				<PathoscopeDetailComponent hit={segmentedHit} mappedCount={1000} />
			</AnalysisSearchProvider>,
		);

		// Both segments are equally empty in the isolate's own data. Failing to hand
		// the list down would label M "no reads" alongside L, which is the claim the
		// isolate cannot make for itself.
		expect(screen.getByText("M · not in this isolate")).toBeVisible();
		expect(screen.getByText("L · no reads")).toBeVisible();
	});
});
