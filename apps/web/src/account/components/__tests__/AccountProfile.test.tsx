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
import type { Account } from "@virtool/contracts";
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

function renderProfile(account: Account) {
	mockGetAccount(account);
	return renderWithProviders(<AccountProfile />);
}

describe("<AccountProfile />", () => {
	it("should render when administrator", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});

		renderProfile(account);

		expect(await screen.findByText(account.username)).toBeInTheDocument();
		expect(screen.getByText("Full Administrator")).toBeInTheDocument();
		expect(
			screen.getByText("Manage who is an administrator and what they can do."),
		).toBeInTheDocument();
	});

	it("should render when not administrator", async () => {
		const account = createFakeAccount({ administratorRole: null });

		renderProfile(account);

		expect(await screen.findByText(account.username)).toBeInTheDocument();
		expect(
			screen.getByText("You are not an administrator."),
		).toBeInTheDocument();
	});

	it("should show the current username and change it", async () => {
		const account = createFakeAccount({ username: "old_username" });
		const updateAccountUsername = mockUpdateAccountUsername(
			{ ...account, username: "new_username" },
			200,
			undefined,
			"new_username",
		);
		renderProfile(account);

		await screen.findByText("Username and avatar");
		expect(screen.getByLabelText("Username")).toHaveValue("old_username");

		await submitUsername("new_username");

		await waitFor(() => expect(updateAccountUsername).toHaveBeenCalled());
	});

	it("should confirm the user's identity before changing the username on a stale session", async () => {
		const account = createFakeAccount({ username: "old_username" });

		userServerFnMocks.updateAccountUsernameFn
			.mockRejectedValueOnce(staleSessionError())
			.mockResolvedValueOnce({ ...account, username: "new_username" });
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
		renderProfile(account);

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

		userServerFnMocks.updateAccountUsernameFn.mockRejectedValue(
			staleSessionError(),
		);
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		renderProfile(account);

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

	it("should show the server's error when the username is taken or reserved", async () => {
		userServerFnMocks.updateAccountUsernameFn
			.mockRejectedValueOnce(new Error("User already exists."))
			.mockRejectedValueOnce(new Error("Reserved username: virtool"));
		renderProfile(createFakeAccount({ username: "old_username" }));

		await submitUsername("taken_username");
		expect(await screen.findByText("User already exists.")).toBeInTheDocument();

		await submitUsername("virtool");
		expect(
			await screen.findByText("Reserved username: virtool"),
		).toBeInTheDocument();
	});

	it("should not submit an empty username", async () => {
		const account = createFakeAccount({ username: "old_username" });

		mockUpdateAccountUsername({ ...account });
		renderProfile(account);

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
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderProfile(account);

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
