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
	it("should show the charts selected by default and switch to the table", async () => {
		const setSearch = renderToolbar();

		expect(screen.getByRole("radio", { name: "Charts" })).toHaveAttribute(
			"data-state",
			"on",
		);
		expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute(
			"data-state",
			"off",
		);

		await userEvent.click(screen.getByRole("radio", { name: "Table" }));

		expect(setSearch).toHaveBeenCalledWith({ table: true });
	});

	it("should show the table selected and switch back to the charts", async () => {
		const setSearch = renderToolbar({ table: true });

		expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute(
			"data-state",
			"on",
		);

		await userEvent.click(screen.getByRole("radio", { name: "Charts" }));

		expect(setSearch).toHaveBeenCalledWith({ table: false });
	});

	// The trigger shows the sort key alone, so its name is the only thing saying
	// the control sorts.
	it("should name the sort trigger for the key it sorts by", () => {
		renderToolbar({ sort: "depth" });

		expect(
			screen.getByRole("button", { name: "Sort by Depth" }),
		).toBeInTheDocument();
	});

	// The direction button is an arrow and nothing else, so its name is all a
	// screen reader has.
	it("should name the sort direction button for the direction it switches to", async () => {
		const setSearch = renderToolbar({ dir: "desc" });

		await userEvent.click(
			screen.getByRole("button", { name: "Sort ascending" }),
		);

		expect(setSearch).toHaveBeenCalledWith({ dir: "asc" });
	});

	// Below 2xl every one of these shows its icon alone, so the tooltip is what
	// says which is which.
	it.each([
		["radio", "Charts", "Chart view"],
		["radio", "Table", "Table view"],
		["button", "Show Reads", "Show read pseudo-counts instead of weight"],
		["button", "Export", "Export results"],
	])("should describe the %s named %s on hover", async (role, name, tip) => {
		renderToolbar();

		await userEvent.hover(screen.getByRole(role, { name }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent(tip);
	});

	// The filters moved behind a popover, so the toolbar only carries its trigger.
	it("should offer the filters behind one button", () => {
		renderToolbar();

		expect(screen.getByRole("button", { name: /^Filter/ })).toBeInTheDocument();
	});
});
