import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	accountServerFnMocks,
	mockGetAccountSecurity,
} from "@tests/server-fn/account";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";

const { twoFactor, resetClient } = vi.hoisted(() => ({
	twoFactor: {
		disable: vi.fn(),
		enable: vi.fn(),
		generateBackupCodes: vi.fn(),
		verifyTotp: vi.fn(),
	},
	resetClient: vi.fn(),
}));

vi.mock("@app/authClient", () => ({ authClient: { twoFactor } }));

vi.mock("@app/utils", async (importOriginal) => ({
	...(await importOriginal<typeof import("@app/utils")>()),
	resetClient,
}));

import AccountTwoFactor from "../AccountTwoFactor";

const TOTP_URI =
	"otpauth://totp/Virtool:alice?secret=JBSWY3DPEHPK3PXP&issuer=Virtool";
const BACKUP_CODES = ["aaaa-1111", "bbbb-2222", "cccc-3333", "dddd-4444"];

function success<T>(data: T) {
	return { data, error: null };
}

function failure(status: number, code?: string) {
	return { data: null, error: { code, message: "", status, statusText: "" } };
}

async function enterPassword(user: ReturnType<typeof userEvent.setup>) {
	const dialog = await screen.findByRole("dialog");
	await user.type(within(dialog).getByLabelText("Password"), "hunter2hunter2");
	return dialog;
}

async function startSetup(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("button", { name: "Set up" }));
	const dialog = await enterPassword(user);
	await user.click(within(dialog).getByRole("button", { name: "Continue" }));
	return dialog;
}

describe("<AccountTwoFactor />", () => {
	it("shows a loading state", () => {
		accountServerFnMocks.getAccountSecurityFn.mockReturnValue(
			new Promise(() => {}),
		);

		renderWithProviders(<AccountTwoFactor />);

		expect(screen.getByRole("status", { name: "loading" })).toBeInTheDocument();
	});

	it("shows an error in this section only", async () => {
		accountServerFnMocks.getAccountSecurityFn.mockRejectedValue(
			new Error("failed"),
		);

		renderWithProviders(<AccountTwoFactor />);

		expect(
			await screen.findByText("Couldn't load your two-factor authentication."),
		).toBeInTheDocument();
	});

	it("shows TOTP off with a set-up control", async () => {
		mockGetAccountSecurity();

		renderWithProviders(<AccountTwoFactor />);

		expect(await screen.findByText("Off")).toBeInTheDocument();
		expect(screen.getByText("Not set up")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Set up" })).toBeInTheDocument();
		expect(screen.queryByText(/requires two-factor/)).toBeNull();
	});

	it("shows TOTP on with the recovery codes left and the required policy", async () => {
		mockGetAccountSecurity({
			mfaRequired: true,
			recoveryCodesRemaining: 8,
			twoFactorEnabled: true,
		});

		renderWithProviders(<AccountTwoFactor />);

		expect(await screen.findByText("On")).toBeInTheDocument();
		expect(screen.getByText("8 recovery codes left")).toBeInTheDocument();
		expect(
			screen.getByText(
				"This Virtool instance requires two-factor authentication.",
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
		expect(screen.queryByText(/Make new codes so that/)).toBeNull();
	});

	it.each([
		[2, "Only 2 recovery codes are left."],
		[1, "Only 1 recovery code is left."],
		[0, "You have no recovery codes left."],
	])("warns when %i recovery codes are left", async (remaining, message) => {
		mockGetAccountSecurity({
			recoveryCodesRemaining: remaining,
			twoFactorEnabled: true,
		});

		renderWithProviders(<AccountTwoFactor />);

		expect(
			await screen.findByText(message, { exact: false }),
		).toBeInTheDocument();
	});

	it("sets up TOTP and requires the user to save the recovery codes", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity();
		twoFactor.enable.mockResolvedValue(
			success({ backupCodes: BACKUP_CODES, totpURI: TOTP_URI }),
		);
		twoFactor.verifyTotp.mockResolvedValue(success({ status: true }));

		renderWithProviders(<AccountTwoFactor />);
		const dialog = await startSetup(user);

		expect(twoFactor.enable).toHaveBeenCalledWith({
			password: "hunter2hunter2",
		});
		expect(
			await within(dialog).findByRole("img", {
				name: "QR code for your authenticator app",
			}),
		).toBeInTheDocument();
		expect(within(dialog).getByLabelText("Setup key")).toHaveValue(
			"JBSWY3DPEHPK3PXP",
		);

		mockGetAccountSecurity({
			recoveryCodesRemaining: 4,
			twoFactorEnabled: true,
		});
		await user.type(within(dialog).getByLabelText("Code"), "123456");
		await user.click(within(dialog).getByRole("button", { name: "Turn on" }));

		expect(twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456" });
		const codes = await within(dialog).findByRole("list", {
			name: "Recovery codes",
		});
		expect(within(codes).getAllByRole("listitem")).toHaveLength(4);
		expect(await screen.findByText("On")).toBeInTheDocument();

		const done = within(dialog).getByRole("button", { name: "Done" });
		expect(done).toBeDisabled();
		await user.keyboard("{Escape}");
		expect(screen.getByRole("dialog")).toBeInTheDocument();

		await user.click(
			within(dialog).getByRole("checkbox", {
				name: "I have saved these codes",
			}),
		);
		await user.click(done);

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("copies every recovery code", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity();
		twoFactor.enable.mockResolvedValue(
			success({ backupCodes: BACKUP_CODES, totpURI: TOTP_URI }),
		);
		twoFactor.verifyTotp.mockResolvedValue(success({ status: true }));
		const clipboard = vi.spyOn(navigator.clipboard, "writeText");

		renderWithProviders(<AccountTwoFactor />);
		const dialog = await startSetup(user);
		await user.type(await within(dialog).findByLabelText("Code"), "123456");
		await user.click(within(dialog).getByRole("button", { name: "Turn on" }));
		await user.click(
			await within(dialog).findByRole("button", { name: "Copy all" }),
		);

		expect(clipboard).toHaveBeenLastCalledWith(BACKUP_CODES.join("\n"));
		expect(
			within(dialog).getByText("Copied to clipboard."),
		).toBeInTheDocument();
	});

	it("shows a wrong password", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity();
		twoFactor.enable.mockResolvedValue(failure(400, "INVALID_PASSWORD"));

		renderWithProviders(<AccountTwoFactor />);
		const dialog = await startSetup(user);

		expect(
			await within(dialog).findByText("The password is not correct."),
		).toBeInTheDocument();
		expect(within(dialog).queryByLabelText("Code")).toBeNull();
	});

	it("shows a wrong code and keeps TOTP off", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity();
		twoFactor.enable.mockResolvedValue(
			success({ backupCodes: BACKUP_CODES, totpURI: TOTP_URI }),
		);
		twoFactor.verifyTotp.mockResolvedValue(failure(401, "INVALID_CODE"));

		renderWithProviders(<AccountTwoFactor />);
		const dialog = await startSetup(user);
		await user.type(await within(dialog).findByLabelText("Code"), "000000");
		await user.click(within(dialog).getByRole("button", { name: "Turn on" }));

		expect(
			await within(dialog).findByText(/The code is not correct/),
		).toBeInTheDocument();
		expect(within(dialog).queryByRole("list")).toBeNull();
		expect(screen.getByText("Off")).toBeInTheDocument();
	});

	it("clears the secret when the user closes the dialog before confirming", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity();
		twoFactor.enable.mockResolvedValue(
			success({ backupCodes: BACKUP_CODES, totpURI: TOTP_URI }),
		);

		renderWithProviders(<AccountTwoFactor />);
		const dialog = await startSetup(user);
		await within(dialog).findByLabelText("Setup key");
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		await user.click(screen.getByRole("button", { name: "Set up" }));

		const reopened = await screen.findByRole("dialog");
		expect(within(reopened).getByLabelText("Password")).toBeInTheDocument();
		expect(within(reopened).queryByLabelText("Setup key")).toBeNull();
	});

	it("makes new recovery codes and clears them on close", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity({
			recoveryCodesRemaining: 1,
			twoFactorEnabled: true,
		});
		twoFactor.generateBackupCodes.mockResolvedValue(
			success({ status: true, backupCodes: BACKUP_CODES }),
		);

		renderWithProviders(<AccountTwoFactor />);
		await user.click(
			await screen.findByRole("button", { name: "New recovery codes" }),
		);
		const dialog = await enterPassword(user);
		await user.click(
			within(dialog).getByRole("button", { name: "Make new codes" }),
		);

		expect(twoFactor.generateBackupCodes).toHaveBeenCalledWith({
			password: "hunter2hunter2",
		});
		expect(await within(dialog).findByText("aaaa-1111")).toBeInTheDocument();
		await user.click(
			within(dialog).getByRole("checkbox", {
				name: "I have saved these codes",
			}),
		);
		await user.click(within(dialog).getByRole("button", { name: "Done" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		await user.click(
			screen.getByRole("button", { name: "New recovery codes" }),
		);

		expect(
			within(await screen.findByRole("dialog")).queryByText("aaaa-1111"),
		).toBeNull();
	});

	it("turns TOTP off", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity({
			recoveryCodesRemaining: 8,
			twoFactorEnabled: true,
		});
		twoFactor.disable.mockResolvedValue(success({ status: true }));

		renderWithProviders(<AccountTwoFactor />);
		await user.click(await screen.findByRole("button", { name: "Turn off" }));
		const dialog = await enterPassword(user);
		mockGetAccountSecurity();
		await user.click(within(dialog).getByRole("button", { name: "Turn off" }));

		expect(twoFactor.disable).toHaveBeenCalledWith({
			password: "hunter2hunter2",
		});
		expect(await screen.findByText("Off")).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(resetClient).not.toHaveBeenCalled();
	});

	it("reloads the app after turning TOTP off when the instance requires it", async () => {
		const user = userEvent.setup();
		mockGetAccountSecurity({
			mfaRequired: true,
			recoveryCodesRemaining: 8,
			twoFactorEnabled: true,
		});
		twoFactor.disable.mockResolvedValue(success({ status: true }));

		renderWithProviders(<AccountTwoFactor />);
		await user.click(await screen.findByRole("button", { name: "Turn off" }));
		const dialog = await enterPassword(user);

		expect(
			within(dialog).getByText(/You must set it up again/),
		).toBeInTheDocument();

		await user.click(within(dialog).getByRole("button", { name: "Turn off" }));

		await waitFor(() => expect(resetClient).toHaveBeenCalled());
	});
});
