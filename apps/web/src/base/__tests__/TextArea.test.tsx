import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { InputGroup } from "../Input";
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

	it("should be marked invalid when a surrounding InputGroup has an error", () => {
		const { getByRole } = renderWithProviders(
			<InputGroup error="Notes are required">
				<TextArea aria-label="Notes" />
			</InputGroup>,
		);

		expect(getByRole("textbox")).toBeInvalid();
	});
});
