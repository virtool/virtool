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
});
