import AccountPassword from "@account/components/AccountPassword";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockChangePassword } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<AccountPassword />", () => {
	it("should handle password changes", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});
		renderWithProviders(
			<AccountPassword lastPasswordChange={account.lastPasswordChange} />,
		);

		expect(await screen.findByText("Password")).toBeInTheDocument();

		const oldPasswordInput = screen.getByLabelText("Old Password");
		const newPasswordInput = screen.getByLabelText("New Password");
		const form = oldPasswordInput.closest("form") as HTMLElement;
		const button = within(form).getByRole("button", { name: "Change" });

		// Try without providing old password.
		await userEvent.type(newPasswordInput, "long_enough_password");
		await userEvent.click(button);

		expect(
			screen.getByText("Please provide your old password"),
		).toBeInTheDocument();

		await userEvent.clear(newPasswordInput);
		await userEvent.type(oldPasswordInput, "expected_password");
		await userEvent.type(newPasswordInput, "short");

		expect(screen.getByLabelText("New Password")).toHaveValue("short");

		await userEvent.click(button);

		expect(
			screen.getByText("Password does not meet minimum length requirement (8)"),
		).toBeInTheDocument();
	});

	it("should show success message after password change", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});

		const changePassword = mockChangePassword(account);

		renderWithProviders(
			<AccountPassword lastPasswordChange={account.lastPasswordChange} />,
		);

		await screen.findByText("Password");

		const oldPasswordInput = screen.getByLabelText("Old Password");
		const newPasswordInput = screen.getByLabelText("New Password");
		const form = oldPasswordInput.closest("form") as HTMLElement;
		const button = within(form).getByRole("button", { name: "Change" });

		await userEvent.type(oldPasswordInput, "old_password_123");
		await userEvent.type(newPasswordInput, "new_password_123");
		await userEvent.click(button);

		await waitFor(() => {
			expect(
				screen.getByText("Password changed. Other browsers were signed out."),
			).toBeInTheDocument();
		});

		expect(changePassword).toHaveBeenCalledWith({
			data: { oldPassword: "old_password_123", password: "new_password_123" },
		});
		expect(oldPasswordInput).toHaveValue("");
		expect(newPasswordInput).toHaveValue("");
	});

	it("shows the server's message when the old password is wrong", async () => {
		const account = createFakeAccount({ administratorRole: "full" });

		mockChangePassword(undefined, 400);

		renderWithProviders(
			<AccountPassword lastPasswordChange={account.lastPasswordChange} />,
		);

		await screen.findByText("Password");

		const oldPasswordInput = screen.getByLabelText("Old Password");
		const form = oldPasswordInput.closest("form") as HTMLElement;

		await userEvent.type(oldPasswordInput, "wrong_password_123");
		await userEvent.type(
			screen.getByLabelText("New Password"),
			"new_password_123",
		);
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(screen.getByText("Invalid credentials")).toBeInTheDocument(),
		);
	});
});
