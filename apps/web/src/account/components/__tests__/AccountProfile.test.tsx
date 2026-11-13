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
import type { Account } from "@virtool/contracts";
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

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(screen.getByText("Full Administrator")).toBeInTheDocument();
		expect(
			screen.getByText("Manage who is an administrator and what they can do."),
		).toBeInTheDocument();
	});

	it("should render when not administrator", async () => {
		const account = createFakeAccount({ administratorRole: null });

		renderProfile(account);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(
			screen.getByText("You are not an administrator."),
		).toBeInTheDocument();
	});

	it("should show the current handle and change it", async () => {
		const account = createFakeAccount({ handle: "old_handle" });
		const updateAccountHandle = mockUpdateAccountHandle(
			{ ...account, handle: "new_handle" },
			200,
			undefined,
			"new_handle",
		);
		renderProfile(account);

		await screen.findByText("Handle and avatar");
		expect(screen.getByLabelText("Handle")).toHaveValue("old_handle");

		await submitHandle("new_handle");

		await waitFor(() => expect(updateAccountHandle).toHaveBeenCalled());
	});

	it("should confirm the user's identity before changing the handle on a stale session", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		userServerFnMocks.updateAccountHandleFn
			.mockRejectedValueOnce(staleSessionError())
			.mockResolvedValueOnce({ ...account, handle: "new_handle" });
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
		renderProfile(account);

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

		userServerFnMocks.updateAccountHandleFn.mockRejectedValue(
			staleSessionError(),
		);
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		renderProfile(account);

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

	it("should show the server's error when the handle is taken or reserved", async () => {
		userServerFnMocks.updateAccountHandleFn
			.mockRejectedValueOnce(new Error("User already exists."))
			.mockRejectedValueOnce(new Error("Reserved username: virtool"));
		renderProfile(createFakeAccount({ handle: "old_handle" }));

		await submitHandle("taken_handle");
		expect(await screen.findByText("User already exists.")).toBeInTheDocument();

		await submitHandle("virtool");
		expect(
			await screen.findByText("Reserved username: virtool"),
		).toBeInTheDocument();
	});

	it("should not submit an empty handle", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockUpdateAccountHandle({ ...account });
		renderProfile(account);

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
