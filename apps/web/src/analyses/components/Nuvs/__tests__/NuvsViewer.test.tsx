import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import NuvsViewer from "@analyses/components/Nuvs/NuvsViewer";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import {
	createFakeFormattedNuvsAnalysis,
	createFakeFormattedNuvsHit,
} from "@tests/fake/analyses";
import { createFakeSample } from "@tests/fake/samples";
import { MemoryRouter } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";

function renderWithAnalysisSearch(
	ui: React.ReactElement,
	search: Partial<AnalysisSearch> = {},
) {
	const queryClient = new QueryClient();

	return render(
		<QueryClientProvider client={queryClient}>
			<AnalysisSearchProvider
				search={{ ...DEFAULT_ANALYSIS_SEARCH, ...search }}
				setSearch={vi.fn()}
			>
				<MemoryRouter>{ui}</MemoryRouter>
			</AnalysisSearchProvider>
		</QueryClientProvider>,
	);
}

describe("<NuvsViewer />", () => {
	// The first hit is the default, so only a later one shows that the search
	// picks the hit the detail renders.
	it("should show the hit the search selects beside the toolbar", async () => {
		const first = createFakeFormattedNuvsHit({ index: 1 });
		const second = createFakeFormattedNuvsHit({ index: 2 });
		const nuvs = createFakeFormattedNuvsAnalysis({
			results: {
				...createFakeFormattedNuvsAnalysis().results,
				hits: [first, second],
			},
		});

		renderWithAnalysisSearch(
			<NuvsViewer detail={nuvs} sample={createFakeSample()} />,
			{ hit: String(second.id) },
		);

		expect(
			await screen.findByRole("heading", {
				name: `Sequence 2 ${second.sequence.length} bp`,
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", {
				name: `Sequence 1 ${first.sequence.length} bp`,
			}),
		).not.toBeInTheDocument();
		expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "BLAST at NCBI" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
	});
});
