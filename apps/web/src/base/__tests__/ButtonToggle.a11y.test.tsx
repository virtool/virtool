import ButtonToggle from "@base/ButtonToggle";
import ToggleGroup from "@base/ToggleGroup";
import ToggleGroupItem from "@base/ToggleGroupItem";
import { render } from "@testing-library/react";
import { expectNoViolations } from "@tests/axe";
import { describe, it, vi } from "vitest";

const withContrast = { rules: { "color-contrast": { enabled: true } } };

describe("toggle contrast in a real browser", () => {
	// Both states have to clear 4.5:1, which is exactly the check jsdom cannot
	// make: `bg-gray-700` with black text would be ~2.6:1 and must fail here.
	it("passes AA in both the on and off states", async () => {
		const { baseElement } = render(
			<main className="bg-white p-4">
				<ButtonToggle onPressedChange={vi.fn()} pressed={false}>
					Filter OTUs
				</ButtonToggle>
				<ButtonToggle onPressedChange={vi.fn()} pressed>
					Filter Isolates
				</ButtonToggle>
				<ToggleGroup onValueChange={vi.fn()} value="table">
					<ToggleGroupItem value="charts">Charts</ToggleGroupItem>
					<ToggleGroupItem value="table">Table</ToggleGroupItem>
				</ToggleGroup>
			</main>,
		);

		await expectNoViolations(baseElement, withContrast);
	});
});
