import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "../Toggle";
import Tooltip from "../Tooltip";

describe("<ToggleGroupItem />", () => {
	// The tooltip trigger publishes its own open state on the member it wraps.
	// Forwarded, it lands on top of the group's, and a hover reads as a
	// deselection to anything keyed on `data-state`.
	it("should let a tooltip wrapping it open and keep the group's selection", async () => {
		render(
			<ToggleGroup onValueChange={vi.fn()} value="charts">
				<Tooltip tip="Chart view">
					<ToggleGroupItem value="charts">Charts</ToggleGroupItem>
				</Tooltip>
				<ToggleGroupItem value="table">Table</ToggleGroupItem>
			</ToggleGroup>,
		);

		const selected = screen.getByRole("radio", { name: "Charts" });

		await userEvent.hover(selected);

		expect(await screen.findByRole("tooltip")).toHaveTextContent("Chart view");
		expect(selected).toHaveAttribute("data-state", "on");
		expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute(
			"data-state",
			"off",
		);
	});
});
