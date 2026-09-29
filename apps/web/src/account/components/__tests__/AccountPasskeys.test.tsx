import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	accountServerFnMocks,
	mockFindPasskeys,
} from "@tests/server-fn/account";
import { renderWithProviders } from "@tests/setup";
import type { PasskeySummary } from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({ startRegistration: vi.fn() }));

vi.mock("@simplewebauthn/browser", () => ({
	startRegistration: browser.startRegistration,
	WebAuthnAbortService: { cancelCeremony: vi.fn() },
}));

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

		renderWithProviders(<AccountPasskeys />);

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

		renderWithProviders(<AccountPasskeys />);

		expect(await screen.findByText("Work laptop")).toBeInTheDocument();
		expect(screen.getAllByText("Synced")).toHaveLength(1);
		expect(screen.getByText("Date added unknown")).toBeInTheDocument();
	});

	it("adds a passkey and refreshes the list", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([]);
		accountServerFnMocks.getPasskeyRegistrationOptionsFn.mockResolvedValue({
			challenge: "challenge",
		});
		browser.startRegistration.mockResolvedValue({
			id: "credential",
			clientExtensionResults: {},
		});
		accountServerFnMocks.registerPasskeyFn.mockResolvedValue(passkey());

		renderWithProviders(<AccountPasskeys />);
		await screen.findByText("You have not added any passkeys.");
		mockFindPasskeys([passkey()]);

		await user.click(screen.getByRole("button", { name: "Add passkey" }));

		expect(await screen.findByText("Work laptop")).toBeInTheDocument();
		expect(browser.startRegistration).toHaveBeenCalledWith({
			optionsJSON: { challenge: "challenge" },
		});
		expect(accountServerFnMocks.registerPasskeyFn).toHaveBeenCalledWith({
			data: { response: { id: "credential" } },
		});
	});

	it("says nothing when the user cancels the browser dialog", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([]);
		accountServerFnMocks.getPasskeyRegistrationOptionsFn.mockResolvedValue({});
		browser.startRegistration.mockRejectedValue(
			Object.assign(new Error("cancelled"), { name: "NotAllowedError" }),
		);

		renderWithProviders(<AccountPasskeys />);
		await user.click(
			await screen.findByRole("button", { name: "Add passkey" }),
		);

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add passkey" })).toBeEnabled(),
		);
		expect(screen.queryByRole("alert")).toBeNull();
		expect(accountServerFnMocks.registerPasskeyFn).not.toHaveBeenCalled();
	});

	it("explains why a browser cannot add passkeys", async () => {
		stubPasskeySupport(false);
		mockFindPasskeys([passkey()]);

		renderWithProviders(<AccountPasskeys />);

		expect(
			await screen.findByText(/This browser cannot use passkeys here/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add passkey" })).toBeDisabled();
		expect(await screen.findByText("Work laptop")).toBeInTheDocument();
	});

	it("renames a passkey", async () => {
		const user = userEvent.setup();
		mockFindPasskeys([passkey()]);
		accountServerFnMocks.renamePasskeyFn.mockResolvedValue(
			passkey({ name: "Phone" }),
		);

		renderWithProviders(<AccountPasskeys />);
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
		const refusal = new Error(
			"Set a password for your account before removing a passkey.",
		);
		refusal.name = "ClientError";
		accountServerFnMocks.removePasskeyFn.mockRejectedValue(refusal);

		renderWithProviders(<AccountPasskeys />);
		await user.click(
			await screen.findByRole("button", { name: "Remove Work laptop" }),
		);
		const dialog = screen.getByRole("alertdialog");
		expect(dialog).toHaveTextContent("Your password");
		await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"Set a password",
		);
		expect(accountServerFnMocks.findPasskeysFn).toHaveBeenCalledTimes(1);
	});
});
