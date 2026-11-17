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
	// The cutoff is what both filters compare against, so it has nothing to act
	// on only once neither is on. Radix marks the thumb `data-disabled` and drops
	// it from the tab order; the `aria-disabled` goes on the root, which carries
	// no role.
	it("should show both filters off and the cutoff disabled at half coverage for an unset search", async () => {
		const setSearch = await openFilter();

		expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();

		const slider = screen.getByRole("slider", { name: "Minimum coverage" });

		expect(slider).toHaveAttribute("aria-valuenow", "0.5");
		expect(slider).toHaveAttribute("data-disabled");
		expect(screen.getByText("0.50")).toBeInTheDocument();

		const otus = screen.getByRole("switch", { name: "Hide low-coverage OTUs" });
		const isolates = screen.getByRole("switch", {
			name: "Hide low-coverage isolates",
		});

		expect(otus).not.toBeChecked();
		expect(isolates).not.toBeChecked();

		await userEvent.click(otus);
		expect(setSearch).toHaveBeenCalledWith({ showLowOtus: false });

		await userEvent.click(isolates);
		expect(setSearch).toHaveBeenCalledWith({ showLowIsolates: false });
	});

	// The trigger carries a dot when hits are being hidden. It is decorative, so
	// the same state rides on the name rather than being sighted-only. Not
	// `aria-pressed` — the trigger already reports the popover through
	// `aria-expanded`.
	//
	// A step lands on the slider as a change; committing each one would push a
	// router navigation per 0.01 of a drag.
	it("should say in its name that hits are hidden, commit a keyboard cutoff, and turn the OTU filter off", async () => {
		const setSearch = await openFilter({ showLowOtus: false });

		expect(
			screen.getByRole("button", { name: "Filter (on)" }),
		).toBeInTheDocument();

		const slider = screen.getByRole("slider", { name: "Minimum coverage" });
		slider.focus();
		await userEvent.keyboard("{ArrowRight}");

		expect(setSearch).toHaveBeenCalledWith({ minCoverage: 0.51 });

		await userEvent.click(
			screen.getByRole("switch", { name: "Hide low-coverage OTUs" }),
		);

		expect(setSearch).toHaveBeenCalledWith({ showLowOtus: true });
	});

	it("should show the cutoff the search carries and keep it live while only the isolate filter is on", async () => {
		await openFilter({ minCoverage: 0.72, showLowIsolates: false });

		expect(screen.getByText("0.72")).toBeInTheDocument();
		expect(
			screen.getByRole("slider", { name: "Minimum coverage" }),
		).not.toHaveAttribute("data-disabled");
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
});
