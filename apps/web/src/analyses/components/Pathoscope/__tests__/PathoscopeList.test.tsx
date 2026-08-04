import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoViolations } from "@tests/axe";
import {
	createFakeAnalysisMinimal,
	createFakePathoscopeHit,
} from "@tests/fake/analyses";
import { renderWithProviders } from "@tests/setup";
import type { PathoscopeHit } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PathoscopeList } from "../PathoscopeList";

const hits = [
	createFakePathoscopeHit({ id: "a", name: "Alpha virus" }),
	createFakePathoscopeHit({
		coverage: 0.25,
		depth: 7,
		id: "b",
		name: "Beta virus",
	}),
];

const analysis: FormattedPathoscopeAnalysis = {
	...createFakeAnalysisMinimal({ workflow: "pathoscope" }),
	files: [],
	results: { hits, readCount: 1000, subtractedCount: 0 },
	workflow: "pathoscope",
};

const writeText = vi.fn().mockResolvedValue(undefined);

// Wrapped in a landmark the way the app shell wraps it, so each hit's
// ``<header>`` is scoped out of the banner role as it is in a real page.
// Ascending is set explicitly so the display order differs from click order
// below, regardless of which direction the app defaults to.
function renderList(
	search: Partial<AnalysisSearch> = {},
	listHits: PathoscopeHit[] = hits,
) {
	return renderWithProviders(
		<main>
			<AnalysisSearchProvider
				search={{
					...DEFAULT_ANALYSIS_SEARCH,
					showLowOtus: true,
					sort: "coverage",
					dir: "asc",
					...search,
				}}
				setSearch={vi.fn()}
			>
				<PathoscopeList
					analysis={{
						...analysis,
						results: { ...analysis.results, hits: listHits },
					}}
				/>
			</AnalysisSearchProvider>
		</main>,
	);
}

beforeEach(() => {
	writeText.mockClear();

	vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
	vi.stubGlobal("isSecureContext", true);
});

describe("<PathoscopeList />", () => {
	// The count is the only statement of how long the list is, so a selection
	// joins it rather than replacing it.
	it("should keep the hit count once a hit is selected", async () => {
		renderList();

		expect(screen.getByText("2 hits")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Copy" }),
		).not.toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("checkbox", { name: "Select Alpha virus" }),
		);

		expect(screen.getByText("1 selected · 2 hits")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
	});

	// A reader cannot see the hits that were held back, so the total is what
	// says they are there.
	it("should count the shown hits against the whole list when filtering", () => {
		// Alpha covers 0.5 and Beta 0.25, so only Alpha clears the cutoff.
		renderList({ showLowOtus: false, minCoverage: 0.3 });

		expect(screen.getByText("1 of 2 hits")).toBeInTheDocument();
	});

	it("should drop the total once nothing is held back", () => {
		renderList({ showLowOtus: false, minCoverage: 0 });

		expect(screen.getByText("2 hits")).toBeInTheDocument();
	});

	it("should copy the selected hits as a tab-separated table", async () => {
		renderList();

		await userEvent.click(
			screen.getByRole("checkbox", { name: "Select Beta virus" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Copy" }));

		expect(writeText).toHaveBeenCalledWith(
			["Name\tWeight\tDepth\tCoverage", "Beta virus\t0.250\t7\t0.250"].join(
				"\n",
			),
		);

		expect(
			await screen.findByRole("button", { name: "Copied" }),
		).toBeInTheDocument();
	});

	// The list is sorted ascending by coverage here, so Beta is shown above
	// Alpha even though Alpha is checked first.
	it("should copy the hits in display order rather than click order", async () => {
		renderList();

		await userEvent.click(
			screen.getByRole("checkbox", { name: "Select Alpha virus" }),
		);
		await userEvent.click(
			screen.getByRole("checkbox", { name: "Select Beta virus" }),
		);

		expect(screen.getByText("2 selected · 2 hits")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Copy" }));

		expect(writeText).toHaveBeenCalledWith(
			[
				"Name\tWeight\tDepth\tCoverage",
				"Beta virus\t0.250\t7\t0.250",
				"Alpha virus\t0.250\t12\t0.500",
			].join("\n"),
		);
	});

	// The trigger is the hit's name and nothing else. One spanning the whole
	// summary row reads every figure in that row out as part of its own name,
	// and bars the row from holding a control or a labelled graphic at all.
	it("should expand a hit from its name alone", async () => {
		renderList();

		const trigger = screen.getByRole("button", { name: "Alpha virus" });

		expect(trigger).toHaveAttribute("aria-expanded", "false");

		await userEvent.click(trigger);

		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByRole("region", { name: "Alpha virus" }),
		).toBeInTheDocument();
	});

	// The checkbox sits beside the accordion trigger rather than inside it; a
	// checkbox nested in the trigger button would trip `nested-interactive`.
	it("should have no accessibility violations", async () => {
		const { container } = renderList();

		await expectNoViolations(container);
	});

	it("should select every hit from the header checkbox", async () => {
		renderList();

		await userEvent.click(
			screen.getByRole("checkbox", { name: "Select all hits" }),
		);

		expect(screen.getByText("2 selected · 2 hits")).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: "Select Alpha virus" }),
		).toBeChecked();
		expect(
			screen.getByRole("checkbox", { name: "Select Beta virus" }),
		).toBeChecked();
	});

	// Scoped to the header because each figure keeps a label of its own for
	// assistive technology, so the same words appear once per hit as well.
	function headerLabels() {
		return within(screen.getByRole("group", { name: "Hit list" }));
	}

	// The columns are labelled on the header rather than on every hit, so a
	// column is named once however long the list is.
	it("should label the columns of figures in the header", () => {
		renderList();

		for (const label of ["Abbreviation", "Weight", "Depth", "Coverage"]) {
			expect(headerLabels().getByText(label)).toBeInTheDocument();
		}
	});

	it("should label the weight column reads when read counts are shown", () => {
		renderList({ reads: true });

		expect(headerLabels().getByText("Reads")).toBeInTheDocument();
		expect(headerLabels().queryByText("Weight")).not.toBeInTheDocument();
	});

	// Nothing fills the column, so a heading would sit over empty space.
	it("should not label the abbreviation column when no hit has one", () => {
		renderList({}, [createFakePathoscopeHit({ abbreviation: "", id: "a" })]);

		expect(headerLabels().queryByText("Abbreviation")).not.toBeInTheDocument();
		expect(headerLabels().getByText("Coverage")).toBeInTheDocument();
	});

	describe("in table mode", () => {
		it("should show one row per hit, with no expandable detail", () => {
			renderList({ table: true });

			const [beta, alpha] = screen.getAllByRole("listitem");

			expect(screen.getAllByRole("listitem")).toHaveLength(2);

			expect(beta).toHaveTextContent("Beta virus");
			expect(beta).toHaveTextContent("0.250");
			expect(beta).toHaveTextContent("7");

			expect(alpha).toHaveTextContent("Alpha virus");
			expect(alpha).toHaveTextContent("12");
			expect(alpha).toHaveTextContent("0.500");

			expect(
				screen.queryByRole("button", { name: /Alpha virus/ }),
			).not.toBeInTheDocument();
		});

		// The columns are labelled by the shared header rather than by the view,
		// so a figure keeps only the label assistive technology reads.
		it("should label each figure without repeating the column names", () => {
			renderList({ reads: true, table: true });

			expect(headerLabels().getByText("Reads")).toBeInTheDocument();
			expect(headerLabels().queryByText("Weight")).not.toBeInTheDocument();

			// Named once by the header, and once more on each hit — those copies
			// are `sr-only`, so only assistive technology reads them.
			expect(screen.getAllByText("Reads")).toHaveLength(hits.length + 1);
			expect(screen.getAllByText("Coverage")).toHaveLength(hits.length + 1);
		});

		it("should copy the hits selected from its rows", async () => {
			renderList({ table: true });

			await userEvent.click(
				screen.getByRole("checkbox", { name: "Select Beta virus" }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Copy" }));

			expect(writeText).toHaveBeenCalledWith(
				["Name\tWeight\tDepth\tCoverage", "Beta virus\t0.250\t7\t0.250"].join(
					"\n",
				),
			);
		});

		it("should have no accessibility violations", async () => {
			const { container } = renderList({ table: true });

			await expectNoViolations(container);
		});
	});
});
