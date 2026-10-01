import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	accountServerFnMocks,
	mockFindPasskeys,
} from "@tests/server-fn/account";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import { renderWithProviders } from "@tests/setup";
import {
	type PasskeySummary,
	SESSION_NOT_FRESH_ERROR_NAME,
} from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addPasskey } = vi.hoisted(() => ({ addPasskey: vi.fn() }));

vi.mock("@app/authClient", () => ({
	authClient: { passkey: { addPasskey } },
}));

vi.mock("@simplewebauthn/browser", () => ({
	WebAuthnAbortService: { cancelCeremony: vi.fn() },
}));

function failure(status: number, code?: string) {
	return {
		data: null,
		error: { code, message: "https://virtool.test", status, statusText: "" },
	};
}

import AccountPasskeys from "../AccountPasskeys";

function passkey(overrides: Partial<PasskeySummary> = {}): PasskeySummary {
	return {
		managementId: 1,
		name: "Work laptop",
		createdAt: new Date("2026-01-01T00:00:00Z"),
		multiDevice: true,
		backedUp: true,
		...overrides,
	};
}

function stubPasskeySupport(available: boolean) {
	vi.stubGlobal("isSecureContext", available);
	vi.stubGlobal(
		"PublicKeyCredential",
		available ? function PublicKeyCredential() {} : undefined,
	);
}

describe("<AccountPasskeys />", () => {
	beforeEach(() => {
		stubPasskeySupport(true);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("shows an empty state", async () => {
		mockFindPasskeys([]);

		renderWithProviders(<AccountPasskeys handle="Alice" />);

		expect(
			await screen.findByText("You have not added any passkeys."),
		).toBeInTheDocument();
	});

	it("lists passkeys with their recognition details", async () => {
		mockFindPasskeys([
			passkey(),
			passkey({
				managementId: 2,
				name: "Key",
				multiDevice: false,
				createdAt: null,
			}),
		]);

		renderWithProviders(<AccountPasskeys handle="Alice" />);

		expect(await screen.findByText("Work laptop")).toBeInTheDocument();
		expect(screen.getAllByText("Synced")).toHaveLength(1);
		expect(screen.getByText("Date added unknown")).toBeInTheDocument();
	});

	it("adds a passkey named after the handle and refreshes the list", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([]);
		addPasskey.mockResolvedValue({ data: {}, error: null });

		renderWithProviders(<AccountPasskeys handle="Alice" />);
		await screen.findByText("You have not added any passkeys.");
		mockFindPasskeys([passkey({ name: "Alice" })]);

		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(await screen.findByText("Alice")).toBeInTheDocument();
		expect(addPasskey).toHaveBeenCalledWith({ name: "Alice" });
	});

	it("says the passkey was not added in a neutral notice when the browser does not allow it", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([]);
		addPasskey.mockResolvedValue(
			failure(400, "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"),
		);

		renderWithProviders(<AccountPasskeys handle="Alice" />);
		await screen.findByText("You have not added any passkeys.");
		await user.click(screen.getByRole("button", { name: "Add" }));

		const notice = await screen.findByRole("status");
		expect(notice).toHaveTextContent("The passkey was not added. Try again.");
		expect(notice.firstElementChild).toHaveClass("bg-gray-100");
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
	});

	it.each([
		["the browser", "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"],
		["the server", "PASSKEY_ALREADY_REGISTERED"],
	])(
		"shows a red alert when %s says the passkey is already registered",
		async (_, code) => {
			const user = userEvent.setup();
			mockFindPasskeys([]);
			addPasskey.mockResolvedValue(failure(400, code));

			renderWithProviders(<AccountPasskeys handle="Alice" />);
			await screen.findByText("You have not added any passkeys.");
			await user.click(screen.getByRole("button", { name: "Add" }));

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent("This passkey is already registered.");
			expect(alert).not.toHaveTextContent("virtool.test");
			expect(alert.firstElementChild).toHaveClass("bg-red-100");
			expect(screen.queryByRole("status")).toBeNull();
		},
	);

	it("confirms the user's identity and registers again when the session is stale", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([]);
		addPasskey
			.mockResolvedValueOnce(failure(403, "SESSION_NOT_FRESH"))
			.mockResolvedValueOnce({ data: {}, error: null });
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			null,
		);

		renderWithProviders(<AccountPasskeys handle="Alice" />);
		await screen.findByText("You have not added any passkeys.");
		await user.click(screen.getByRole("button", { name: "Add" }));

		const challenge = await screen.findByRole("dialog", {
			name: "Confirm your identity",
		});
		await user.type(within(challenge).getByLabelText("Password"), "password");
		await user.click(
			within(challenge).getByRole("button", { name: "Continue" }),
		);

		await waitFor(() => expect(addPasskey).toHaveBeenCalledTimes(2));
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("explains why a browser cannot add passkeys", async () => {
		stubPasskeySupport(false);
		mockFindPasskeys([passkey()]);

		renderWithProviders(<AccountPasskeys handle="Alice" />);

		expect(
			await screen.findByText(/This browser cannot use passkeys here/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
		expect(await screen.findByText("Work laptop")).toBeInTheDocument();
	});

	it("renames a passkey", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([passkey()]);
		accountServerFnMocks.renamePasskeyFn.mockResolvedValue(
			passkey({ name: "Phone" }),
		);

		renderWithProviders(<AccountPasskeys handle="Alice" />);
		await user.click(
			await screen.findByRole("button", { name: "Rename Work laptop" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Rename passkey" });
		const input = within(dialog).getByLabelText("Name");
		await user.clear(input);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));

		expect(
			await within(dialog).findByText("Enter a name."),
		).toBeInTheDocument();
		expect(accountServerFnMocks.renamePasskeyFn).not.toHaveBeenCalled();

		await user.type(input, "Phone");
		await user.click(within(dialog).getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(accountServerFnMocks.renamePasskeyFn).toHaveBeenCalledWith({
				data: { managementId: 1, name: "Phone" },
			}),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("keeps the dialog open with the server's refusal to remove a passkey", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([passkey()]);
		const refusal = new Error("Passkey not found.");
		refusal.name = "ClientError";
		accountServerFnMocks.removePasskeyFn.mockRejectedValue(refusal);

		renderWithProviders(<AccountPasskeys handle="Alice" />);
		await user.click(
			await screen.findByRole("button", { name: "Remove Work laptop" }),
		);
		const dialog = screen.getByRole("alertdialog");
		expect(dialog).toHaveTextContent("Your password");
		await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"Passkey not found.",
		);
		expect(accountServerFnMocks.findPasskeysFn).toHaveBeenCalledTimes(1);
	});

	it("keeps the dialog open without an error when the identity check is cancelled", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([passkey()]);
		accountServerFnMocks.removePasskeyFn.mockRejectedValue(
			Object.assign(new Error("Recent authentication required"), {
				name: SESSION_NOT_FRESH_ERROR_NAME,
			}),
		);
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);

		renderWithProviders(<AccountPasskeys handle="Alice" />);
		await user.click(
			await screen.findByRole("button", { name: "Remove Work laptop" }),
		);
		await user.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Confirm",
			}),
		);
		const challenge = await screen.findByRole("dialog", {
			name: "Confirm your identity",
		});
		await within(challenge).findByLabelText("Password");
		await user.click(within(challenge).getByRole("button", { name: "Cancel" }));

		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Confirm your identity" }),
			).toBeNull(),
		);
		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).queryByRole("alert")).toBeNull();
		expect(accountServerFnMocks.removePasskeyFn).toHaveBeenCalledTimes(1);
	});
});
