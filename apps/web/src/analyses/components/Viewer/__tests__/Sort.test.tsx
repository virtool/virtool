import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { AnalysisViewerSort } from "../Sort";

describe("<AnalysisViewerSort />", () => {
	it("should mark the active sort key as the checked radio item", async () => {
		renderWithProviders(
			<AnalysisViewerSort
				workflow="pathoscope"
				sortKey="coverage"
				onSelect={vi.fn()}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: /Sort/ }));

		expect(
			await screen.findByRole("menuitemradio", { name: "Coverage" }),
		).toBeChecked();
		expect(
			screen.getByRole("menuitemradio", { name: "Depth" }),
		).not.toBeChecked();
	});

	it("should call onSelect with the chosen sort key", async () => {
		const onSelect = vi.fn();

		renderWithProviders(
			<AnalysisViewerSort
				workflow="pathoscope"
				sortKey="coverage"
				onSelect={onSelect}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: /Sort/ }));
		await userEvent.click(
			await screen.findByRole("menuitemradio", { name: "Weight" }),
		);

		expect(onSelect).toHaveBeenCalledWith("weight");
	});

	it("should offer sorting pathoscope hits by name", async () => {
		const onSelect = vi.fn();

		renderWithProviders(
			<AnalysisViewerSort
				workflow="pathoscope"
				sortKey="name"
				onSelect={onSelect}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Sort by Name" }));

		expect(
			await screen.findByRole("menuitemradio", { name: "Name" }),
		).toBeChecked();
	});
});
