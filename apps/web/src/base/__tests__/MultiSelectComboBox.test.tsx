import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import MultiSelectComboBox from "../MultiSelectComboBox";

type Fruit = { id: number; name: string };

const apple: Fruit = { id: 1, name: "Apple" };
const banana: Fruit = { id: 2, name: "Banana" };
const cherry: Fruit = { id: 3, name: "Cherry" };
const fruits = [apple, banana, cherry];

/** Holds the selection and term the way a caller does. */
function Harness({ initialSelected = [] }: { initialSelected?: Fruit[] }) {
	const [selected, setSelected] = useState(initialSelected);
	const [term, setTerm] = useState("");

	return (
		<MultiSelectComboBox<Fruit>
			label="Fruits"
			items={fruits.filter((fruit) => fruit.name.includes(term))}
			selectedItems={selected}
			onChange={setSelected}
			term={term}
			onTermChange={setTerm}
			itemToKey={(fruit) => String(fruit.id)}
			itemToString={(fruit) => fruit.name}
		/>
	);
}

function renderComboBox(initialSelected?: Fruit[]) {
	renderWithProviders(<Harness initialSelected={initialSelected} />);

	return screen.getByRole("combobox", { name: "Fruits" });
}

async function openMenu() {
	await userEvent.click(
		screen.getByRole("button", { name: "Toggle Fruits menu" }),
	);
}

describe("<MultiSelectComboBox />", () => {
	it("adds a chosen option as a chip, keeps the menu open, and clears the term", async () => {
		const input = renderComboBox();

		await userEvent.type(input, "Ch");
		await userEvent.click(screen.getByRole("option", { name: "Cherry" }));

		expect(
			screen.getByRole("button", { name: "Remove Cherry" }),
		).toBeInTheDocument();
		expect(input).toHaveValue("");
		expect(screen.queryByRole("option", { name: "Cherry" })).toBeNull();
		expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
	});

	it("shows pre-selected items as chips and leaves them out of the menu", async () => {
		renderComboBox([banana]);

		expect(
			screen.getByRole("button", { name: "Remove Banana" }),
		).toBeInTheDocument();

		await openMenu();

		expect(screen.queryByRole("option", { name: "Banana" })).toBeNull();
	});

	it("returns an item to the menu when its chip is removed", async () => {
		renderComboBox([cherry]);

		await userEvent.click(
			screen.getByRole("button", { name: "Remove Cherry" }),
		);

		expect(screen.queryByRole("button", { name: "Remove Cherry" })).toBeNull();

		await openMenu();

		expect(screen.getByRole("option", { name: "Cherry" })).toBeInTheDocument();
	});

	it("removes the last chip when Backspace is pressed in the empty input", async () => {
		const input = renderComboBox([banana, cherry]);

		input.focus();
		await userEvent.keyboard("{Backspace}");

		expect(screen.queryByRole("button", { name: "Remove Cherry" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Remove Banana" }),
		).toBeInTheDocument();
	});
});
