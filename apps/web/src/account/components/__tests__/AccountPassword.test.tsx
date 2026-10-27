import AccountPassword from "@account/components/AccountPassword";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockChangePassword } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

async function openDialog() {
	await userEvent.click(await screen.findByRole("button", { name: "Change" }));
	return screen.findByRole("dialog");
}

describe("<AccountPassword />", () => {
	it("should handle password changes", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});
		renderWithProviders(
			<AccountPassword lastPasswordChange={account.lastPasswordChange} />,
		);

		expect(await screen.findByText(/Last changed/)).toBeInTheDocument();

		const dialog = await openDialog();
		const oldPasswordInput = within(dialog).getByLabelText("Current password");
		const newPasswordInput = within(dialog).getByLabelText("New password");
		const button = within(dialog).getByRole("button", { name: "Change" });

		// Try without providing the current password.
		await userEvent.type(newPasswordInput, "long_enough_password");
		await userEvent.click(button);

		expect(
			screen.getByText("Please provide your current password"),
		).toBeInTheDocument();

		await userEvent.clear(newPasswordInput);
		await userEvent.type(oldPasswordInput, "expected_password");
		await userEvent.type(newPasswordInput, "short");

		expect(screen.getByLabelText("New password")).toHaveValue("short");

		await userEvent.click(button);

		expect(
			screen.getByText("Password does not meet minimum length requirement (8)"),
		).toBeInTheDocument();
	});

	it("closes the dialog and confirms the change", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});

		const changePassword = mockChangePassword(account);

		renderWithProviders(
			<AccountPassword lastPasswordChange={account.lastPasswordChange} />,
		);

		const dialog = await openDialog();

		await userEvent.type(
			within(dialog).getByLabelText("Current password"),
			"old_password_123",
		);
		await userEvent.type(
			within(dialog).getByLabelText("New password"),
			"new_password_123",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Change" }),
		);

		await waitFor(() => {
			expect(
				screen.getByText("Password changed. Other browsers were signed out."),
			).toBeInTheDocument();
		});

		expect(changePassword).toHaveBeenCalledWith({
			data: { oldPassword: "old_password_123", password: "new_password_123" },
		});
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		const reopened = await openDialog();
		expect(within(reopened).getByLabelText("Current password")).toHaveValue("");
		expect(within(reopened).getByLabelText("New password")).toHaveValue("");
	});

	it("shows the server's message when the current password is wrong", async () => {
		const account = createFakeAccount({ administratorRole: "full" });

		mockChangePassword(undefined, 400);

		renderWithProviders(
			<AccountPassword lastPasswordChange={account.lastPasswordChange} />,
		);

		const dialog = await openDialog();

		await userEvent.type(
			within(dialog).getByLabelText("Current password"),
			"wrong_password_123",
		);
		await userEvent.type(
			within(dialog).getByLabelText("New password"),
			"new_password_123",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Change" }),
		);

		expect(
			await within(dialog).findByText("Invalid credentials"),
		).toBeInTheDocument();
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});
});
