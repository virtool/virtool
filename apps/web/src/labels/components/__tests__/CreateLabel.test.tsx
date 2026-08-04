import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { DEFAULT_LABEL_COLOR } from "@virtool/contracts";
import { describe, expect, it, vi } from "vitest";
import { CreateLabel } from "../CreateLabel";

describe("<CreateLabel>", () => {
	it("submits with the selected color", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		renderWithProviders(<CreateLabel onSubmit={onSubmit} />);

		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		const nameInput = screen.getByLabelText("Name");
		const descriptionInput = screen.getByLabelText("Description");

		await userEvent.type(descriptionInput, "This is a description");
		await userEvent.type(nameInput, "Foo");
		await userEvent.click(screen.getByRole("radio", { name: "Grey" }));
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				name: "Foo",
				description: "This is a description",
				color: "#6B7280",
			}),
		);
	});

	it("submits with the default color when none picked", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		renderWithProviders(<CreateLabel onSubmit={onSubmit} />);

		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		await userEvent.type(
			screen.getByLabelText("Description"),
			"This is a description",
		);
		await userEvent.type(screen.getByLabelText("Name"), "Foo");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				name: "Foo",
				description: "This is a description",
				color: DEFAULT_LABEL_COLOR,
			}),
		);
	});

	it("blocks submit when name is empty", async () => {
		const onSubmit = vi.fn();
		renderWithProviders(<CreateLabel onSubmit={onSubmit} />);

		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();

		await userEvent.type(screen.getByLabelText("Color"), "#1DAD57");
		await userEvent.type(
			screen.getByLabelText("Description"),
			"This is a description",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByText("Name is required.")).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("shows the rejection message and keeps the dialog open on failure", async () => {
		const onSubmit = vi
			.fn()
			.mockRejectedValue(new Error("Label name already exists."));
		renderWithProviders(<CreateLabel onSubmit={onSubmit} />);

		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		await userEvent.type(screen.getByLabelText("Name"), "Foo");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(
				screen.getByText("Label name already exists."),
			).toBeInTheDocument(),
		);
		// Form is still in the document — dialog stayed open.
		expect(screen.getByLabelText("Name")).toBeInTheDocument();
	});
});
