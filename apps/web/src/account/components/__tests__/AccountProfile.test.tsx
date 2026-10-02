import AccountProfile from "@account/components/AccountProfile";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import {
	mockGetAccount,
	mockUpdateAccountHandle,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<AccountProfile />", () => {
	it("should leave the sign-in controls to the security page", async () => {
		const account = createFakeAccount();

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(screen.queryByText("Email")).not.toBeInTheDocument();
		expect(screen.queryByText("Password")).not.toBeInTheDocument();
		expect(screen.queryByText("Passkeys")).not.toBeInTheDocument();
	});

	it("should render when administrator", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(screen.getByText("Full Administrator")).toBeInTheDocument();
		expect(
			screen.getByText("Manage who is an administrator and what they can do."),
		).toBeInTheDocument();
	});

	it("should render when not administrator", async () => {
		const account = createFakeAccount({ administratorRole: null });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(
			screen.getByText("You are not an administrator."),
		).toBeInTheDocument();
	});

	it("should render with the current handle", async () => {
		const account = createFakeAccount({ handle: "current_handle" });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle and avatar");
		expect(screen.getByLabelText("Handle")).toHaveValue("current_handle");
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

		await screen.findByText("Handle and avatar");
		const input = screen.getByLabelText("Handle");
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

		await screen.findByText("Handle and avatar");
		const input = screen.getByLabelText("Handle");
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

		await screen.findByText("Handle and avatar");
		const input = screen.getByLabelText("Handle");
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

		await screen.findByText("Handle and avatar");
		const input = screen.getByLabelText("Handle");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		expect(
			await screen.findByText("Please specify a username"),
		).toBeInTheDocument();
		expect(userServerFnMocks.updateAccountHandleFn).not.toHaveBeenCalled();
	});

	it("should save the Gravatar choice when toggled", async () => {
		const account = createFakeAccount();
		const saved = { ...account.settings, avatarSource: "gravatar" as const };
		mockGetAccount(account);
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderWithProviders(<AccountProfile />);

		const toggle = await screen.findByRole("switch", { name: "Use Gravatar" });
		expect(toggle).not.toBeChecked();

		mockGetAccount({ ...account, settings: saved });

		await userEvent.click(toggle);

		await waitFor(() =>
			expect(userServerFnMocks.updateAccountSettingsFn).toHaveBeenCalledWith({
				data: { avatarSource: "gravatar" },
			}),
		);
		expect(toggle).toBeChecked();
	});
});
