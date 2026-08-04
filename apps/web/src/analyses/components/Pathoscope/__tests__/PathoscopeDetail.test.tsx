import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import type { PathoscopeHit, PathoscopeIsolate } from "@virtool/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import PathoscopeDetailComponent from "../PathoscopeDetail";

afterEach(() => {
	vi.restoreAllMocks();
});

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
	it("should hide isolates under the coverage cutoff", () => {
		renderDetail();

		expect(screen.getByText("Covered")).toBeInTheDocument();
		expect(screen.queryByText("Sparse")).not.toBeInTheDocument();
	});

	it("should show every isolate once the filter is off", () => {
		renderDetail({ showLowIsolates: true });

		expect(screen.getByText("Covered")).toBeInTheDocument();
		expect(screen.getByText("Sparse")).toBeInTheDocument();
	});

	it("should hold isolates to the cutoff the search carries", () => {
		renderDetail({ minCoverage: 0.95 });

		expect(screen.queryByText("Covered")).not.toBeInTheDocument();
	});

	it("should tell each isolate which of the otu's segments it does not carry", () => {
		// jsdom lays nothing out, so the chart measures its container at zero and
		// draws no panels to label without a width.
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);

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
