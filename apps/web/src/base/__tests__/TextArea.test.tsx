import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Field, { FieldError, FieldLabel } from "../Field";
import TextArea from "../TextArea";

describe("<TextArea />", () => {
	it("should forward aria attributes to the underlying textarea", () => {
		const { getByRole } = renderWithProviders(
			<TextArea
				aria-describedby="notes-error"
				aria-label="Notes"
				required
				rows={4}
			/>,
		);

		const textarea = getByRole("textbox");

		expect(textarea.tagName).toBe("TEXTAREA");
		expect(textarea).toHaveAttribute("aria-describedby", "notes-error");
		expect(textarea).toHaveAttribute("rows", "4");
		expect(textarea).toBeRequired();
	});

	it("should connect to a surrounding Field", () => {
		const { getByRole } = renderWithProviders(
			<Field>
				<FieldLabel>Notes</FieldLabel>
				<TextArea />
				<FieldError>Notes are required</FieldError>
			</Field>,
		);

		const textarea = getByRole("textbox", { name: "Notes" });

		expect(textarea).toBeInvalid();
		expect(textarea).toHaveAccessibleDescription("Notes are required");
	});
});
