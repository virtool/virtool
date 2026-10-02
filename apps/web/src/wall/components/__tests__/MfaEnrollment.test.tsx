import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { authServerFnMocks } from "@tests/server-fn/auth";
import {
	mockGetAccount,
	mockGetAccountMfaEnrollmentRequired,
	mockGetAccountUnauthorized,
} from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";

const { twoFactor, resetClient } = vi.hoisted(() => ({
	twoFactor: {
		enable: vi.fn(),
		verifyTotp: vi.fn(),
	},
	resetClient: vi.fn(),
}));

vi.mock("@app/authClient", () => ({ authClient: { twoFactor } }));

vi.mock("@app/utils", async (importOriginal) => ({
	...(await importOriginal<typeof import("@app/utils")>()),
	resetClient,
}));

const TOTP_URI =
	"otpauth://totp/Virtool:alice?secret=JBSWY3DPEHPK3PXP&issuer=Virtool";
const BACKUP_CODES = ["aaaa-1111", "bbbb-2222"];

function renderEnrollment(path = "/mfa-enrollment?redirect=%2Fsamples") {
	mockGetAccountMfaEnrollmentRequired();
	return renderRoute(path, {
		seed: (queryClient) => {
			queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

describe("<MfaEnrollment />", () => {
	it("enrolls, shows the recovery codes once, and follows the server", async () => {
		const user = userEvent.setup();
		twoFactor.enable.mockResolvedValue({
			data: { backupCodes: BACKUP_CODES, totpURI: TOTP_URI },
			error: null,
		});
		twoFactor.verifyTotp.mockResolvedValue({ data: {}, error: null });

		const { router } = await renderEnrollment();

		expect(
			await screen.findByRole("heading", {
				name: "Set up two-factor authentication",
			}),
		).toBeInTheDocument();
		await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(
			await screen.findByRole("img", {
				name: "QR code for your authenticator app",
			}),
		).toBeInTheDocument();
		expect(screen.getByDisplayValue("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
		expect(screen.queryByText("aaaa-1111")).toBeNull();

		await user.type(screen.getByLabelText("Code"), "123456");
		await user.click(screen.getByRole("button", { name: "Turn on" }));

		expect(await screen.findByText("aaaa-1111")).toBeInTheDocument();
		expect(twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456" });
		const done = screen.getByRole("button", { name: "Done" });
		expect(done).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: "Cancel and sign out" }),
		).toBeNull();

		mockGetAccount(createFakeAccount());
		await user.click(screen.getByText("I have saved these codes"));
		await user.click(done);

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/samples"),
		);
	});

	it("keeps the user on the password step when the password is wrong", async () => {
		twoFactor.enable.mockResolvedValue({
			data: null,
			error: { code: "INVALID_PASSWORD", status: 400 },
		});

		await renderEnrollment();

		await userEvent.type(
			await screen.findByLabelText("Password"),
			"wrong-password",
		);
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		expect(
			await screen.findByText("The password is not correct."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("img", {
				name: "QR code for your authenticator app",
			}),
		).toBeNull();
	});

	it("signs the user out on cancel", async () => {
		authServerFnMocks.logoutFn.mockResolvedValue(null);

		await renderEnrollment();

		await userEvent.click(
			await screen.findByRole("button", { name: "Cancel and sign out" }),
		);

		await waitFor(() => expect(resetClient).toHaveBeenCalled());
		expect(authServerFnMocks.logoutFn).toHaveBeenCalledOnce();
	});

	it("sends a signed-out visitor to sign in", async () => {
		mockGetAccountUnauthorized();

		const { router } = await renderRoute(
			"/mfa-enrollment?redirect=%2Fsamples",
			{
				seed: (queryClient) => {
					queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
				},
			},
		);

		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(router.state.location.search).toEqual({ redirect: "/samples" });
	});
});
