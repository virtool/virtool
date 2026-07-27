import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import NuvsViewer from "@analyses/components/Nuvs/NuvsViewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeFormattedNuVsAnalysis } from "@tests/fake/analyses";
import { createFakeSample } from "@tests/fake/samples";
import { mockBlastNuvs } from "@tests/server-fn/analyses";
import { at, MemoryRouter } from "@tests/setup";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function renderWithAnalysisSearch(
	ui: React.ReactElement,
	search: { activeHit?: string } = {},
) {
	const queryClient = new QueryClient();

	return render(
		<QueryClientProvider client={queryClient}>
			<AnalysisSearchProvider search={search} setSearch={vi.fn()}>
				<MemoryRouter>{ui}</MemoryRouter>
			</AnalysisSearchProvider>
		</QueryClientProvider>,
	);
}

describe("<NuvsViewer />", () => {
	let sample: ReturnType<typeof createFakeSample>;
	let nuvs: ReturnType<typeof createFakeFormattedNuVsAnalysis>;
	let firstHit: (typeof nuvs.results.hits)[number];
	let props: { detail: typeof nuvs; sample: typeof sample };

	beforeEach(() => {
		sample = createFakeSample();
		nuvs = createFakeFormattedNuVsAnalysis();

		firstHit = at(nuvs.results.hits, 0);

		props = {
			detail: nuvs,
			sample: sample,
		};
	});

	afterEach(() => nock.cleanAll());

	describe("<NuVsDetail />", () => {
		it("should default to the first hit when no active hit is set", async () => {
			renderWithAnalysisSearch(<NuvsViewer {...props} />);

			expect(
				await screen.findByText(
					"This sequence has no BLAST information attached to it.",
				),
			).toBeInTheDocument();
			expect(screen.getByText("Families")).toBeInTheDocument();
			expect(screen.queryByText("No Hits")).not.toBeInTheDocument();
		});

		it("should render correctly", async () => {
			renderWithAnalysisSearch(<NuvsViewer {...props} />, {
				activeHit: String(firstHit.id),
			});

			expect(
				await screen.findByText(
					"This sequence has no BLAST information attached to it.",
				),
			).toBeInTheDocument();
			expect(screen.getByText("Families")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "BLAST at NCBI" }),
			).toBeInTheDocument();
		});

		it("should render blast when clicked", async () => {
			const blastNuvs = mockBlastNuvs(firstHit.index);
			renderWithAnalysisSearch(<NuvsViewer {...props} />, {
				activeHit: String(firstHit.id),
			});

			await userEvent.click(
				await screen.findByRole("button", { name: "BLAST at NCBI" }),
			);
			await waitFor(() => expect(blastNuvs).toHaveBeenCalled());
		});
	});

	describe("<NuVsExport />", () => {
		it("should render export dialog when exporting", async () => {
			renderWithAnalysisSearch(<NuvsViewer {...props} />, {
				activeHit: String(firstHit.id),
			});

			await userEvent.click(
				await screen.findByRole("button", { name: "Export" }),
			);
			expect(screen.getByText("Export Analysis")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Download" }),
			).toBeInTheDocument();
		});
	});
});
