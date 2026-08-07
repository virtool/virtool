import AccountProfile from "@account/components/AccountProfile";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import {
	mockChangePassword,
	mockGetAccount,
	mockUpdateAccountEmail,
	mockUpdateAccountHandle,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<AccountProfile />", () => {
	it("should render when administrator", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(screen.getByText("full Administrator")).toBeInTheDocument();
	});

	it("should render when not administrator", async () => {
		const account = createFakeAccount({ administratorRole: null });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
	});

	it("should render with initial email", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
			email: "virtool.devs@gmail.com",
		});

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText("Email Address")).toBeInTheDocument();

		expect(screen.getByLabelText("Email Address")).toHaveValue(
			"virtool.devs@gmail.com",
		);
	});

	it("should handle email changes", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
			email: "",
		});

		mockGetAccount(account);
		const updateAccountEmail = mockUpdateAccountEmail(
			account,
			200,
			undefined,
			"virtool.devs@gmail.com",
		);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Email Address");
		const input = screen.getByLabelText("Email Address");
		expect(input).toHaveValue("");

		const form = input.closest("form") as HTMLElement;
		const button = within(form).getByRole("button", { name: "Change" });

		await userEvent.type(input, "invalid");
		await userEvent.click(button);

		expect(input).toHaveValue("invalid");
		expect(
			screen.getByText("Please provide a valid email address"),
		).toBeInTheDocument();
		expect(updateAccountEmail).not.toHaveBeenCalled();

		await userEvent.clear(input);
		await userEvent.type(input, "virtool.devs@gmail.com");
		await userEvent.click(button);

		await waitFor(() => expect(updateAccountEmail).toHaveBeenCalled());
	});

	it("should render with the current handle", async () => {
		const account = createFakeAccount({ handle: "current_handle" });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		expect(screen.getByLabelText("Username")).toHaveValue("current_handle");
	});

	it("should change the handle", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		const updateAccountHandle = mockUpdateAccountHandle(
			{ ...account, handle: "new_handle" },
			200,
			undefined,
			"new_handle",
		);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "new_handle");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() => expect(updateAccountHandle).toHaveBeenCalled());
	});

	it("should show a conflict error when the handle is taken", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		mockUpdateAccountHandle(undefined, 409, "User already exists.");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "taken_handle");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(screen.getByText("User already exists.")).toBeInTheDocument(),
		);
	});

	it("should show an error when the handle is reserved", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		mockUpdateAccountHandle(undefined, 400, "Reserved user name: virtool");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "virtool");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(
				screen.getByText("Reserved user name: virtool"),
			).toBeInTheDocument(),
		);
	});

	it("should not submit an empty handle", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		mockUpdateAccountHandle({ ...account });
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		expect(
			await screen.findByText("Please specify a username"),
		).toBeInTheDocument();
		expect(userServerFnMocks.updateAccountHandleFn).not.toHaveBeenCalled();
	});

	it("should handle password changes", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});
		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

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

		mockGetAccount(account);
		const changePassword = mockChangePassword(account);

		renderWithProviders(<AccountProfile />);

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
				screen.getByText("Password changed successfully"),
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

		mockGetAccount(account);
		mockChangePassword(undefined, 400);

		renderWithProviders(<AccountProfile />);

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
