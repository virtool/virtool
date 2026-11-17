import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Field, { FieldError, FieldLabel } from "../Field";
import TextArea from "../TextArea";

describe("<TextArea />", () => {
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
