import AccountProfile from "@account/components/AccountProfile";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import {
	mockGetAccount,
	mockUpdateAccountHandle,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { SESSION_NOT_FRESH_ERROR_NAME } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

function staleSessionError() {
	return Object.assign(new Error("Recent authentication required"), {
		name: SESSION_NOT_FRESH_ERROR_NAME,
	});
}

async function submitHandle(handle: string) {
	await screen.findByText("Handle and avatar");
	const input = screen.getByLabelText("Handle");
	const form = input.closest("form") as HTMLElement;

	await userEvent.clear(input);
	await userEvent.type(input, handle);
	await userEvent.click(within(form).getByRole("button", { name: "Change" }));
}

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

	it("should confirm the user's identity before changing the handle on a stale session", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		userServerFnMocks.updateAccountHandleFn
			.mockRejectedValueOnce(staleSessionError())
			.mockResolvedValueOnce({ ...account, handle: "new_handle" });
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
		renderWithProviders(<AccountProfile />);

		await submitHandle("new_handle");

		const challenge = await screen.findByRole("dialog", {
			name: "Confirm your identity",
		});
		await userEvent.type(
			await within(challenge).findByLabelText("Password"),
			"hunter2hunter2",
		);
		await userEvent.click(
			within(challenge).getByRole("button", { name: "Continue" }),
		);

		await waitFor(() =>
			expect(userServerFnMocks.updateAccountHandleFn).toHaveBeenCalledTimes(2),
		);
		expect(userServerFnMocks.updateAccountHandleFn).toHaveBeenLastCalledWith({
			data: { handle: "new_handle" },
		});
	});

	it("should show no error when the identity check for a handle change is cancelled", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		userServerFnMocks.updateAccountHandleFn.mockRejectedValue(
			staleSessionError(),
		);
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		renderWithProviders(<AccountProfile />);

		await submitHandle("new_handle");

		const challenge = await screen.findByRole("dialog", {
			name: "Confirm your identity",
		});
		await within(challenge).findByLabelText("Password");
		await userEvent.click(
			within(challenge).getByRole("button", { name: "Cancel" }),
		);

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Confirm your identity" }),
			).toBeNull(),
		);
		expect(
			screen.queryByText("Recent authentication was cancelled."),
		).toBeNull();
		expect(userServerFnMocks.updateAccountHandleFn).toHaveBeenCalledTimes(1);
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
		mockUpdateAccountHandle(undefined, 400, "Reserved username: virtool");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle and avatar");
		const input = screen.getByLabelText("Handle");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "virtool");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(
				screen.getByText("Reserved username: virtool"),
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
