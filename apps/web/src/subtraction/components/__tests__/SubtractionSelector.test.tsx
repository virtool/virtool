import type { SubtractionOption } from "@subtraction/types";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import SubtractionSelector from "../SubtractionSelector";

const subtractions: SubtractionOption[] = [
	{ id: 1, name: "Arabidopsis", ready: true, isDefault: true },
	{ id: 2, name: "Human", ready: true },
	{ id: 3, name: "Mouse", ready: true },
	{ id: 4, name: "Rice", ready: true },
];

function Harness() {
	const [selected, setSelected] = useState<number[]>([]);

	return (
		<SubtractionSelector
			subtractions={subtractions}
			selected={selected}
			onChange={setSelected}
		/>
	);
}

async function openMenu(): Promise<void> {
	await userEvent.click(
		screen.getByRole("button", { name: "Toggle Subtractions menu" }),
	);
}

describe("<SubtractionSelector>", () => {
	it("marks the default subtraction in both the menu and its chip", async () => {
		renderWithProviders(<Harness />);

		await openMenu();

		expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
			"ArabidopsisDefault",
			"Human",
			"Mouse",
			"Rice",
		]);

		const defaultOption = screen.getByRole("option", { name: /Arabidopsis/ });
		expect(within(defaultOption).getByText("Default")).toBeVisible();

		await userEvent.click(defaultOption);
		const chip = screen.getByRole("button", {
			name: "Remove Arabidopsis",
		}).parentElement as HTMLElement;
		expect(within(chip).getByText("(default)")).toBeVisible();
	});

	it("filters the options by the search term", async () => {
		renderWithProviders(<Harness />);

		await openMenu();
		await userEvent.type(
			screen.getByRole("combobox", { name: "Subtractions" }),
			"Mouse",
		);

		expect(screen.getByRole("option", { name: "Mouse" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "Human" })).toBeNull();
	});
});
