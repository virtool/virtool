import AccountProfile from "@account/components/AccountProfile";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import {
	mockGetAccount,
	mockUpdateAccountUsername,
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

async function submitUsername(username: string) {
	await screen.findByText("Username and avatar");
	const input = screen.getByLabelText("Username");
	const form = input.closest("form") as HTMLElement;

	await userEvent.clear(input);
	await userEvent.type(input, username);
	await userEvent.click(within(form).getByRole("button", { name: "Change" }));
}

describe("<AccountProfile />", () => {
	it("should leave the sign-in controls to the security page", async () => {
		const account = createFakeAccount();

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.username)).toBeInTheDocument();
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

		expect(await screen.findByText(account.username)).toBeInTheDocument();
		expect(screen.getByText("Full Administrator")).toBeInTheDocument();
		expect(
			screen.getByText("Manage who is an administrator and what they can do."),
		).toBeInTheDocument();
	});

	it("should render when not administrator", async () => {
		const account = createFakeAccount({ administratorRole: null });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.username)).toBeInTheDocument();
		expect(
			screen.getByText("You are not an administrator."),
		).toBeInTheDocument();
	});

	it("should render with the current username", async () => {
		const account = createFakeAccount({ username: "current_username" });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Username and avatar");
		expect(screen.getByLabelText("Username")).toHaveValue("current_username");
	});

	it("should change the username", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockGetAccount(account);
		const updateAccountUsername = mockUpdateAccountUsername(
			{ ...account, username: "new_username" },
			200,
			undefined,
			"new_username",
		);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Username and avatar");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "new_username");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() => expect(updateAccountUsername).toHaveBeenCalled());
	});

	it("should confirm the user's identity before changing the username on a stale session", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockGetAccount(account);
		userServerFnMocks.updateAccountUsernameFn
			.mockRejectedValueOnce(staleSessionError())
			.mockResolvedValueOnce({ ...account, username: "new_username" });
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
		renderWithProviders(<AccountProfile />);

		await submitUsername("new_username");

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
			expect(userServerFnMocks.updateAccountUsernameFn).toHaveBeenCalledTimes(
				2,
			),
		);
		expect(userServerFnMocks.updateAccountUsernameFn).toHaveBeenLastCalledWith({
			data: { username: "new_username" },
		});
	});

	it("should show no error when the identity check for a username change is cancelled", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockGetAccount(account);
		userServerFnMocks.updateAccountUsernameFn.mockRejectedValue(
			staleSessionError(),
		);
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		renderWithProviders(<AccountProfile />);

		await submitUsername("new_username");

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
		expect(userServerFnMocks.updateAccountUsernameFn).toHaveBeenCalledTimes(1);
	});

	it("should show a conflict error when the username is taken", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockGetAccount(account);
		mockUpdateAccountUsername(undefined, 409, "User already exists.");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Username and avatar");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "taken_username");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(screen.getByText("User already exists.")).toBeInTheDocument(),
		);
	});

	it("should show an error when the username is reserved", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockGetAccount(account);
		mockUpdateAccountUsername(undefined, 400, "Reserved username: virtool");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Username and avatar");
		const input = screen.getByLabelText("Username");
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

	it("should not submit an empty username", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockGetAccount(account);
		mockUpdateAccountUsername({ ...account });
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Username and avatar");
		const input = screen.getByLabelText("Username");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		expect(
			await screen.findByText("Please specify a username"),
		).toBeInTheDocument();
		expect(userServerFnMocks.updateAccountUsernameFn).not.toHaveBeenCalled();
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
