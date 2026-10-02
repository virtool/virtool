import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Input from "../Input";

describe("<Input />", () => {
	it("should forward aria attributes to the underlying input", () => {
		const { getByRole } = renderWithProviders(
			<Input
				aria-activedescendant="option-2"
				aria-controls="listbox"
				aria-describedby="handle-error"
				aria-expanded={true}
				aria-label="Handle"
				autoComplete="username"
				required
				role="combobox"
			/>,
		);

		const input = getByRole("combobox");

		expect(input).toHaveAttribute("aria-activedescendant", "option-2");
		expect(input).toHaveAttribute("aria-controls", "listbox");
		expect(input).toHaveAttribute("aria-describedby", "handle-error");
		expect(input).toHaveAttribute("aria-expanded", "true");
		expect(input).toHaveAttribute("autocomplete", "username");
		expect(input).toBeRequired();
	});

	it("should not be marked invalid when there is no error", () => {
		const { getByRole } = renderWithProviders(<Input aria-label="Handle" />);

		expect(getByRole("textbox")).not.toHaveAttribute("aria-invalid");
	});

	it("should be marked invalid when passed aria-invalid", () => {
		const { getByRole } = renderWithProviders(
			<Input aria-invalid aria-label="Handle" />,
		);

		expect(getByRole("textbox")).toBeInvalid();
	});
});
