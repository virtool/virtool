import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ButtonToggle } from "../Button";
import Tooltip from "../Tooltip";

describe("<ButtonToggle />", () => {
	it("should report its state through aria-pressed and a press to its owner", async () => {
		const onPressedChange = vi.fn();

		render(
			<ButtonToggle onPressedChange={onPressedChange} pressed={false}>
				Filter OTUs
			</ButtonToggle>,
		);

		const button = screen.getByRole("button", { name: "Filter OTUs" });

		expect(button).toHaveAttribute("aria-pressed", "false");

		await userEvent.click(button);

		expect(onPressedChange).toHaveBeenCalledWith(true);
	});

	// A Radix tooltip hands its behaviour to the trigger as props. Naming this
	// component's props exhaustively dropped them, so every tooltip wrapping a
	// toggle in the app was inert. The tooltip trigger also publishes its own
	// open state on the button it wraps, which would land on top of the
	// toggle's.
	it("should let a tooltip wrapping it open and keep reporting its own state", async () => {
		render(
			<Tooltip tip="Hide OTUs with low coverage support">
				<ButtonToggle onPressedChange={vi.fn()} pressed>
					Filter OTUs
				</ButtonToggle>
			</Tooltip>,
		);

		const button = screen.getByRole("button", { name: "Filter OTUs" });

		await userEvent.hover(button);

		// Radix renders the tip twice — once drawn, once for screen readers — so
		// the role is what identifies it.
		expect(await screen.findByRole("tooltip")).toMatchTextContent(
			"Hide OTUs with low coverage support",
		);
		expect(button).toHaveAttribute("aria-describedby");
		expect(button).toHaveAttribute("aria-pressed", "true");
		expect(button).toHaveAttribute("data-state", "on");
	});
});
