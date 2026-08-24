import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ButtonToggle } from "../Button";
import Tooltip from "../Tooltip";

describe("<ButtonToggle />", () => {
	it("should report its state through aria-pressed", () => {
		render(
			<ButtonToggle onPressedChange={vi.fn()} pressed>
				Filter OTUs
			</ButtonToggle>,
		);

		expect(screen.getByRole("button", { name: "Filter OTUs" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	// Styled off `aria-pressed` rather than Radix's `data-state`, so what is
	// announced and what is drawn cannot drift apart.
	it("should draw the on state from the same attribute it announces", () => {
		render(
			<ButtonToggle onPressedChange={vi.fn()} pressed>
				Filter OTUs
			</ButtonToggle>,
		);

		const button = screen.getByRole("button", { name: "Filter OTUs" });

		expect(button).toHaveClass("aria-pressed:bg-gray-700");
		expect(button).toHaveClass("aria-pressed:text-white");
	});

	// A Radix tooltip hands its behaviour to the trigger as props. Naming this
	// component's props exhaustively dropped them, so every tooltip wrapping a
	// toggle in the app was inert.
	it("should let a tooltip wrapping it open", async () => {
		render(
			<Tooltip tip="Hide OTUs with low coverage support">
				<ButtonToggle onPressedChange={vi.fn()} pressed={false}>
					Filter OTUs
				</ButtonToggle>
			</Tooltip>,
		);

		await userEvent.hover(screen.getByRole("button", { name: "Filter OTUs" }));

		// Radix renders the tip twice — once drawn, once for screen readers — so
		// the role is what identifies it.
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Hide OTUs with low coverage support",
		);
		expect(screen.getByRole("button", { name: "Filter OTUs" })).toHaveAttribute(
			"aria-describedby",
		);
	});

	// The tooltip trigger publishes its own open state on the button it wraps,
	// which would land on top of the toggle's.
	it("should keep reporting its own state while a tooltip is open", async () => {
		render(
			<Tooltip tip="Hide OTUs with low coverage support">
				<ButtonToggle onPressedChange={vi.fn()} pressed>
					Filter OTUs
				</ButtonToggle>
			</Tooltip>,
		);

		const button = screen.getByRole("button", { name: "Filter OTUs" });

		await userEvent.hover(button);
		await screen.findByRole("tooltip");

		expect(button).toHaveAttribute("aria-pressed", "true");
		expect(button).toHaveAttribute("data-state", "on");
	});

	it("should report a press to its owner", async () => {
		const onPressedChange = vi.fn();

		render(
			<ButtonToggle onPressedChange={onPressedChange} pressed={false}>
				Filter OTUs
			</ButtonToggle>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Filter OTUs" }));

		expect(onPressedChange).toHaveBeenCalledWith(true);
	});
});
