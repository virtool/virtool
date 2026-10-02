import AccountSessions from "@account/components/AccountSessions";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	accountServerFnMocks,
	mockFindActiveBrowserSessions,
} from "@tests/server-fn/account";
import { renderWithProviders } from "@tests/setup";
import type { ActiveBrowserSession } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

function session(
	overrides: Partial<ActiveBrowserSession> = {},
): ActiveBrowserSession {
	return {
		managementId: 1,
		browser: "Firefox",
		operatingSystem: "Linux",
		ipAddress: "10.0.0.1",
		createdAt: new Date("2026-01-01T00:00:00Z"),
		lastActivityAt: new Date("2026-01-02T00:00:00Z"),
		expiresAt: new Date("2099-01-01T00:00:00Z"),
		isCurrent: true,
		...overrides,
	};
}

const other = session({
	managementId: 2,
	browser: "Safari",
	operatingSystem: "macOS",
	ipAddress: null,
	isCurrent: false,
});

describe("<AccountSessions />", () => {
	it("shows a loading state", () => {
		accountServerFnMocks.findActiveBrowserSessionsFn.mockReturnValue(
			new Promise(() => {}),
		);

		renderWithProviders(<AccountSessions />);

		expect(screen.getByRole("status", { name: "loading" })).toBeInTheDocument();
	});

	it("shows an error in this section only", async () => {
		accountServerFnMocks.findActiveBrowserSessionsFn.mockRejectedValue(
			new Error("failed"),
		);

		renderWithProviders(<AccountSessions />);

		expect(
			await screen.findByText("Couldn't load your sessions."),
		).toBeInTheDocument();
	});

	it("marks the current browser and gives it no sign-out control", async () => {
		mockFindActiveBrowserSessions([session()]);

		renderWithProviders(<AccountSessions />);

		expect(await screen.findByText("Firefox on Linux")).toBeInTheDocument();
		expect(screen.getByText("This browser")).toBeInTheDocument();
		expect(screen.getByText(/10\.0\.0\.1/)).toBeInTheDocument();
		expect(
			screen.getByText("You are not signed in on other browsers."),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Sign out/ })).toBeNull();
	});

	it("signs out one other session after confirmation", async () => {
		const user = userEvent.setup();
		mockFindActiveBrowserSessions([session(), other]);
		accountServerFnMocks.revokeBrowserSessionFn.mockResolvedValue(null);

		renderWithProviders(<AccountSessions />);

		expect(await screen.findByText(/IP address unknown/)).toBeInTheDocument();
		mockFindActiveBrowserSessions([session()]);
		await user.click(
			screen.getByRole("button", { name: "Sign out Safari on macOS" }),
		);

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Sign out session")).toBeInTheDocument();
		await user.click(within(dialog).getByRole("button", { name: "Sign out" }));

		await waitFor(() =>
			expect(accountServerFnMocks.revokeBrowserSessionFn).toHaveBeenCalledWith({
				data: { managementId: 2 },
			}),
		);
		await waitFor(() =>
			expect(screen.queryByText("Safari on macOS")).not.toBeInTheDocument(),
		);
	});

	it("signs out every other session after confirmation", async () => {
		const user = userEvent.setup();
		mockFindActiveBrowserSessions([session(), other]);
		accountServerFnMocks.revokeOtherBrowserSessionsFn.mockResolvedValue({
			revoked: 1,
		});

		renderWithProviders(<AccountSessions />);

		await screen.findByText("Safari on macOS");
		await user.click(
			screen.getByRole("button", { name: "Sign out other sessions" }),
		);

		const dialog = await screen.findByRole("alertdialog");
		await user.click(
			within(dialog).getByRole("button", { name: "Sign out all" }),
		);

		await waitFor(() =>
			expect(
				accountServerFnMocks.revokeOtherBrowserSessionsFn,
			).toHaveBeenCalled(),
		);
	});

	it("keeps the session when the user cancels", async () => {
		const user = userEvent.setup();
		mockFindActiveBrowserSessions([session(), other]);

		renderWithProviders(<AccountSessions />);

		await user.click(
			await screen.findByRole("button", { name: "Sign out Safari on macOS" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Cancel",
			}),
		);

		expect(accountServerFnMocks.revokeBrowserSessionFn).not.toHaveBeenCalled();
		expect(screen.getByText("Safari on macOS")).toBeInTheDocument();
	});
});
