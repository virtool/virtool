import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { PathoscopeToolbar } from "../PathoscopeToolbar";

const analysis: FormattedPathoscopeAnalysis = {
	...createFakeAnalysisMinimal({ id: 5, workflow: "pathoscope" }),
	files: [],
	results: { hits: [], readCount: 1000, subtractedCount: 0 },
	workflow: "pathoscope",
};

function renderToolbar(search: Partial<AnalysisSearch> = {}) {
	const setSearch = vi.fn();

	renderWithProviders(
		<AnalysisSearchProvider
			search={{ ...DEFAULT_ANALYSIS_SEARCH, ...search }}
			setSearch={setSearch}
		>
			<PathoscopeToolbar analysis={analysis} />
		</AnalysisSearchProvider>,
	);

	return setSearch;
}

describe("<PathoscopeToolbar />", () => {
	// The trigger shows the sort key alone, so its name is the only thing saying
	// the control sorts. The filters sit behind a popover, so the toolbar only
	// carries its trigger.
	it("should show the charts selected, name the sort and filter triggers, and switch to the table", async () => {
		const setSearch = renderToolbar({ sort: "depth" });

		expect(screen.getByRole("radio", { name: "Charts" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Table" })).not.toBeChecked();
		expect(
			screen.getByRole("button", { name: "Sort by Depth" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Filter/ })).toBeInTheDocument();

		await userEvent.click(screen.getByRole("radio", { name: "Table" }));

		expect(setSearch).toHaveBeenCalledWith({ table: true });
	});

	// The direction button is an arrow and nothing else, so its name is all a
	// screen reader has.
	it("should show the table selected, switch the sort direction, and switch back to the charts", async () => {
		const setSearch = renderToolbar({ dir: "desc", table: true });

		expect(screen.getByRole("radio", { name: "Table" })).toBeChecked();

		await userEvent.click(
			screen.getByRole("button", { name: "Sort ascending" }),
		);

		expect(setSearch).toHaveBeenCalledWith({ dir: "asc" });

		await userEvent.click(screen.getByRole("radio", { name: "Charts" }));

		expect(setSearch).toHaveBeenCalledWith({ table: false });
	});

	// Below 2xl the toolbar's controls show their icons alone, so the tooltip is
	// what says which is which.
	it("should describe an icon-only control on hover", async () => {
		renderToolbar();

		await userEvent.hover(screen.getByRole("button", { name: "Show Reads" }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Show read pseudo-counts instead of weight",
		);
	});
});
