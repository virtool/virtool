import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { DeleteLabel } from "../DeleteLabel";

describe("<DeleteLabel>", () => {
	it("confirms deletion and closes the dialog on success", async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		renderWithProviders(<DeleteLabel name="Foo" onConfirm={onConfirm} />);

		await userEvent.click(screen.getByRole("button", { name: "Delete" }));

		expect(
			screen.getByText(/are you sure you want to delete/i),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
		await waitFor(() =>
			expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument(),
		);
	});

	it("keeps the dialog open when deletion fails", async () => {
		const onConfirm = vi.fn().mockRejectedValue(new Error("oops"));
		renderWithProviders(<DeleteLabel name="Foo" onConfirm={onConfirm} />);

		await userEvent.click(screen.getByRole("button", { name: "Delete" }));
		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
		expect(
			screen.getByText(/are you sure you want to delete/i),
		).toBeInTheDocument();
	});
});
