import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import PathoscopeFilter from "../PathoscopeFilter";

async function openFilter(search: Partial<AnalysisSearch> = {}) {
	const setSearch = vi.fn();

	renderWithProviders(
		<AnalysisSearchProvider
			search={{ ...DEFAULT_ANALYSIS_SEARCH, ...search }}
			setSearch={setSearch}
		>
			<PathoscopeFilter />
		</AnalysisSearchProvider>,
	);

	await userEvent.click(screen.getByRole("button", { name: /^Filter/ }));

	return setSearch;
}

describe("<PathoscopeFilter />", () => {
	// The trigger carries a dot when hits are being hidden. It is decorative, so
	// the same state rides on the name rather than being sighted-only. Not
	// `aria-pressed` — the trigger already reports the popover through
	// `aria-expanded`.
	it("should say in its name that hits are being hidden", () => {
		renderWithProviders(
			<AnalysisSearchProvider
				search={DEFAULT_ANALYSIS_SEARCH}
				setSearch={vi.fn()}
			>
				<PathoscopeFilter />
			</AnalysisSearchProvider>,
		);

		expect(
			screen.getByRole("button", { name: "Filter (on)" }),
		).toBeInTheDocument();
	});

	it("should drop that from its name once nothing is filtered", () => {
		renderWithProviders(
			<AnalysisSearchProvider
				search={{
					...DEFAULT_ANALYSIS_SEARCH,
					showLowIsolates: true,
					showLowOtus: true,
				}}
				setSearch={vi.fn()}
			>
				<PathoscopeFilter />
			</AnalysisSearchProvider>,
		);

		expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
	});

	it("should show both filters on, which is what an unset search means", async () => {
		await openFilter();

		expect(
			screen.getByRole("switch", { name: "Hide low-coverage OTUs" }),
		).toBeChecked();
		expect(
			screen.getByRole("switch", { name: "Hide low-coverage isolates" }),
		).toBeChecked();
	});

	it("should turn the OTU filter off", async () => {
		const setSearch = await openFilter();

		await userEvent.click(
			screen.getByRole("switch", { name: "Hide low-coverage OTUs" }),
		);

		expect(setSearch).toHaveBeenCalledWith({ showLowOtus: true });
	});

	it("should turn the isolate filter off", async () => {
		const setSearch = await openFilter();

		await userEvent.click(
			screen.getByRole("switch", { name: "Hide low-coverage isolates" }),
		);

		expect(setSearch).toHaveBeenCalledWith({ showLowIsolates: true });
	});

	// Isolates are only ever shown in an expanded hit, which the table layout
	// does not render.
	it("should drop the isolate switch in the table layout", async () => {
		await openFilter({ table: true });

		expect(
			screen.getByRole("switch", { name: "Hide low-coverage OTUs" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("switch", { name: "Hide low-coverage isolates" }),
		).not.toBeInTheDocument();
	});

	it("should start the cutoff at half coverage", async () => {
		await openFilter();

		expect(
			screen.getByRole("slider", { name: "Minimum coverage" }),
		).toHaveAttribute("aria-valuenow", "0.5");
		expect(screen.getByText("0.50")).toBeInTheDocument();
	});

	it("should keep the cutoff live while only one filter is on", async () => {
		await openFilter({ showLowOtus: true });

		expect(
			screen.getByRole("slider", { name: "Minimum coverage" }),
		).not.toHaveAttribute("data-disabled");
	});

	it("should show the cutoff the search carries", async () => {
		await openFilter({ minCoverage: 0.72 });

		expect(screen.getByText("0.72")).toBeInTheDocument();
	});

	// The cutoff is what both filters compare against, so it has nothing to act
	// on only once neither is on. Radix marks the thumb `data-disabled` and drops
	// it from the tab order; the `aria-disabled` goes on the root, which carries
	// no role.
	it("should disable the cutoff once neither filter is on", async () => {
		await openFilter({ showLowIsolates: true, showLowOtus: true });

		expect(
			screen.getByRole("slider", { name: "Minimum coverage" }),
		).toHaveAttribute("data-disabled");
	});

	// A step lands on the slider as a change; committing each one would push a
	// router navigation per 0.01 of a drag.
	it("should commit a cutoff moved with the keyboard", async () => {
		const setSearch = await openFilter();

		const slider = screen.getByRole("slider", { name: "Minimum coverage" });
		slider.focus();
		await userEvent.keyboard("{ArrowRight}");

		expect(setSearch).toHaveBeenCalledWith({ minCoverage: 0.51 });
	});
});
