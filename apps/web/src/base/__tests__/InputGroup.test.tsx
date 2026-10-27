import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Field, { FieldError, FieldLabel } from "../Field";
import { InputPassword } from "../Input";
import InputGroup, {
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "../InputGroup";

describe("<InputGroup />", () => {
	it("should focus the input when an addon is clicked", async () => {
		renderWithProviders(
			<InputGroup>
				<InputGroupInput aria-label="Price" />
				<InputGroupAddon align="inline-end">
					<InputGroupText>CAD</InputGroupText>
				</InputGroupAddon>
			</InputGroup>,
		);

		await userEvent.click(screen.getByText("CAD"));

		expect(screen.getByRole("textbox", { name: "Price" })).toHaveFocus();
	});

	it("should connect its input to a surrounding Field", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Price</FieldLabel>
				<InputGroup>
					<InputGroupInput />
				</InputGroup>
				<FieldError>Price is required</FieldError>
			</Field>,
		);

		const input = screen.getByRole("textbox", { name: "Price" });

		expect(input).toBeInvalid();
		expect(input).toHaveAccessibleDescription("Price is required");
	});
});

describe("<InputPassword />", () => {
	it("should toggle password visibility", async () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Password</FieldLabel>
				<InputPassword name="password" />
			</Field>,
		);

		const input = screen.getByLabelText("Password");
		expect(input).toHaveAttribute("type", "password");

		await userEvent.click(screen.getByRole("button", { name: "Show" }));

		expect(input).toHaveAttribute("type", "text");
	});
});
