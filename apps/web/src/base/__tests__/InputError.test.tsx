import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { InputError } from "../Input";

describe("<InputError />", () => {
	it("should announce its message as an assertive live region", () => {
		const { getByRole } = renderWithProviders(
			<InputError id="handle-error">Handle is required</InputError>,
		);

		const alert = getByRole("alert");

		expect(alert).toHaveTextContent("Handle is required");
		expect(alert).toHaveAttribute("id", "handle-error");
	});

	it("should show a non-color icon alongside the message", () => {
		const { getByRole } = renderWithProviders(
			<InputError>Handle is required</InputError>,
		);

		expect(getByRole("alert").querySelector("svg")).not.toBeNull();
	});

	it("should not show an icon when there is no error", () => {
		const { getByRole } = renderWithProviders(<InputError>{""}</InputError>);

		expect(getByRole("alert").querySelector("svg")).toBeNull();
	});
});
