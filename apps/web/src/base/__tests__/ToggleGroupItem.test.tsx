import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ToggleGroup from "../ToggleGroup";
import ToggleGroupItem from "../ToggleGroupItem";
import Tooltip from "../Tooltip";

function renderGroup() {
	render(
		<ToggleGroup onValueChange={vi.fn()} value="charts">
			<Tooltip tip="Chart view">
				<ToggleGroupItem value="charts">Charts</ToggleGroupItem>
			</Tooltip>
			<ToggleGroupItem value="table">Table</ToggleGroupItem>
		</ToggleGroup>,
	);
}

describe("<ToggleGroupItem />", () => {
	it("should let a tooltip wrapping it open", async () => {
		renderGroup();

		await userEvent.hover(screen.getByRole("radio", { name: "Charts" }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent("Chart view");
	});

	// The tooltip trigger publishes its own open state on the member it wraps.
	// Forwarded, it lands on top of the group's, and a hover reads as a
	// deselection to anything keyed on `data-state`.
	it("should keep reporting the group's selection while a tooltip is open", async () => {
		renderGroup();

		const selected = screen.getByRole("radio", { name: "Charts" });

		await userEvent.hover(selected);
		await screen.findByRole("tooltip");

		expect(selected).toHaveAttribute("data-state", "on");
		expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute(
			"data-state",
			"off",
		);
	});
});
