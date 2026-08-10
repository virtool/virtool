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
	it("exposes an accessible combobox labelled 'Labels'", async () => {
		await renderWithRouter(<Harness />);

		expect(screen.getByRole("combobox", { name: "Labels" })).toBeVisible();
	});

	it("lists the available labels as options when opened", async () => {
		await renderWithRouter(<Harness />);

		await openMenu();

		const options = screen.getAllByRole("option");
		expect(options.map((option) => option.textContent)).toEqual([
			"Bacteria",
			"Fungi",
			"Virus",
		]);
	});

	it("adds a label when its option is chosen", async () => {
		await renderWithRouter(<Harness />);

		await openMenu();
		await userEvent.click(screen.getByRole("option", { name: "Fungi" }));

		// Selected labels become removable chips and drop out of the option list.
		expect(
			screen.getByRole("button", { name: "Remove Fungi" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "Fungi" })).toBeNull();
	});

	it("renders pre-selected labels as chips and hides them from the menu", async () => {
		await renderWithRouter(<Harness initialSelected={[3]} />);

		expect(
			screen.getByRole("button", { name: "Remove Virus" }),
		).toBeInTheDocument();

		await openMenu();
		expect(screen.queryByRole("option", { name: "Virus" })).toBeNull();
	});

	it("removes a label when its chip close button is clicked", async () => {
		await renderWithRouter(<Harness initialSelected={[1]} />);

		await userEvent.click(
			screen.getByRole("button", { name: "Remove Bacteria" }),
		);

		expect(
			screen.queryByRole("button", { name: "Remove Bacteria" }),
		).toBeNull();

		await openMenu();
		expect(
			screen.getByRole("option", { name: "Bacteria" }),
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
