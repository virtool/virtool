import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "@tests/setup";
import type { Label } from "@virtool/contracts";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import LabelSelector from "../LabelSelector";

const labels: Label[] = [
	{ id: 1, name: "Bacteria", color: "#3B82F6", description: "", count: 0 },
	{ id: 2, name: "Fungi", color: "#22C55E", description: "", count: 0 },
	{ id: 3, name: "Virus", color: "#EF4444", description: "", count: 0 },
];

function Harness({
	initialSelected = [],
	items = labels,
}: {
	initialSelected?: number[];
	items?: Label[];
}) {
	const [selected, setSelected] = useState(initialSelected);

	return (
		<LabelSelector labels={items} selected={selected} onChange={setSelected} />
	);
}

async function openMenu(): Promise<void> {
	await userEvent.click(
		screen.getByRole("button", { name: "Toggle Labels menu" }),
	);
}

describe("<LabelSelector>", () => {
	it("exposes a labelled combobox that lists the available labels when opened", async () => {
		await renderWithRouter(<Harness />);

		expect(screen.getByRole("combobox", { name: "Labels" })).toBeVisible();

		await openMenu();

		const options = screen.getAllByRole("option");
		expect(options.map((option) => option.textContent)).toEqual([
			"Bacteria",
			"Fungi",
			"Virus",
		]);
	});

	it("maps the selected ids to chips and chip changes back to ids", async () => {
		await renderWithRouter(<Harness initialSelected={[3]} />);

		expect(
			screen.getByRole("button", { name: "Remove Virus" }),
		).toBeInTheDocument();

		await openMenu();
		await userEvent.click(screen.getByRole("option", { name: "Fungi" }));

		expect(
			screen.getByRole("button", { name: "Remove Fungi" }),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Remove Virus" }));

		expect(screen.queryByRole("button", { name: "Remove Virus" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Remove Fungi" }),
		).toBeInTheDocument();
	});

	it("filters the options by the search term", async () => {
		await renderWithRouter(<Harness />);

		await openMenu();
		await userEvent.type(
			screen.getByRole("combobox", { name: "Labels" }),
			"Virus",
		);

		expect(screen.getByRole("option", { name: "Virus" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "Fungi" })).toBeNull();
	});

	it("prompts the user to create a label when none exist", async () => {
		await renderWithRouter(<Harness items={[]} />);

		expect(screen.getByText(/No labels found\./)).toBeVisible();
		expect(screen.getByRole("link", { name: "Create one" })).toBeVisible();
	});
});
