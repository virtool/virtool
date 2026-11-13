import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { at, renderWithProviders } from "@tests/setup";
import { Popover } from "radix-ui";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import FilterComboboxPopover from "../FilterComboboxPopover";

type Fruit = { id: number; name: string };

const fruits: Fruit[] = [
	{ id: 1, name: "Apple" },
	{ id: 2, name: "Banana" },
	{ id: 3, name: "Cherry" },
];

/** Holds the selection and opens the popover from a trigger, as a caller does. */
function Harness({ pinned }: { pinned?: Fruit }) {
	const [selected, setSelected] = useState<number[]>([]);

	function handleToggle(id: number) {
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((key) => key !== id) : [...prev, id],
		);
	}

	return (
		<Popover.Root>
			<Popover.Trigger>Fruits</Popover.Trigger>
			<FilterComboboxPopover
				emptyMessage="No fruits."
				getKey={(fruit) => fruit.id}
				getText={(fruit) => fruit.name}
				inputLabel="Filter fruits"
				items={pinned ? fruits.filter((fruit) => fruit !== pinned) : fruits}
				listboxLabel="Fruits"
				noMatchesMessage="No fruits found."
				onClear={() => setSelected([])}
				onToggle={handleToggle}
				pinned={pinned}
				placeholder="Name"
				popoverLabel="Filter by fruit"
				scrollAreaTestId="other-fruits"
				selected={selected}
			/>
		</Popover.Root>
	);
}

async function openPopover(pinned?: Fruit) {
	renderWithProviders(<Harness pinned={pinned} />);
	await userEvent.click(screen.getByRole("button", { name: "Fruits" }));

	return screen.findByLabelText("Filter fruits");
}

describe("<FilterComboboxPopover />", () => {
	it("should focus the search input and narrow the options as it is typed in", async () => {
		const input = await openPopover();
		expect(input).toHaveFocus();

		await userEvent.type(input, "Ban");

		expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
			"Banana",
		]);
	});

	it("should say when no option matches the search", async () => {
		await userEvent.type(await openPopover(), "zzz");

		expect(screen.getByText("No fruits found.")).toBeInTheDocument();
		expect(screen.queryByRole("option")).not.toBeInTheDocument();
	});

	it("should toggle the highlighted option with Enter and keep focus in the input", async () => {
		const input = await openPopover();
		await userEvent.type(input, "Cher");
		await userEvent.keyboard("{Enter}");

		expect(screen.getByRole("option", { name: "Cherry" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(input).toHaveFocus();

		await userEvent.keyboard("{Enter}");

		expect(screen.getByRole("option", { name: "Cherry" })).toHaveAttribute(
			"aria-selected",
			"false",
		);
	});

	it("should deselect every option when cleared", async () => {
		await openPopover();
		await userEvent.click(screen.getByRole("option", { name: "Apple" }));
		await userEvent.click(screen.getByRole("option", { name: "Banana" }));

		await userEvent.click(screen.getByRole("button", { name: "Clear" }));

		for (const option of screen.getAllByRole("option")) {
			expect(option).toHaveAttribute("aria-selected", "false");
		}
		expect(
			screen.queryByRole("button", { name: "Clear" }),
		).not.toBeInTheDocument();
	});

	it("should clear the search on the first Escape and close on the next", async () => {
		const input = await openPopover();
		await userEvent.type(input, "zzz");

		await userEvent.keyboard("{Escape}");
		expect(input).toHaveValue("");
		expect(input).toBeInTheDocument();

		await userEvent.keyboard("{Escape}");
		expect(screen.queryByLabelText("Filter fruits")).not.toBeInTheDocument();
	});

	it("should show the pinned option first, apart from the scrolling list", async () => {
		const pinned = at(fruits, 2);
		await openPopover(pinned);

		const options = screen.getAllByRole("option");
		expect(options.map((o) => o.textContent)).toEqual([
			"Cherry",
			"Apple",
			"Banana",
		]);
		expect(screen.getByTestId("other-fruits")).not.toContainElement(
			at(options, 0),
		);
	});
});
