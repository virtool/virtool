import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { ReferenceRight } from "../ReferenceRight";

describe("<ReferenceRight />", () => {
	it("describes the right and toggles it off", async () => {
		const onToggle = vi.fn();

		renderWithProviders(
			<ReferenceRight right="build" enabled onToggle={onToggle} />,
		);

		expect(screen.getByText("build")).toBeInTheDocument();
		expect(
			screen.getByText("Can build new indexes for the reference."),
		).toBeInTheDocument();
		expect(screen.getByRole("checkbox")).toBeChecked();

		await userEvent.click(screen.getByRole("checkbox"));

		expect(onToggle).toHaveBeenCalledWith("build", false);
	});
});
