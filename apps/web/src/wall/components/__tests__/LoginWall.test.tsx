import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { mockGetPasswordPolicy } from "@tests/server-fn/settings";
import {
	mockGetAccountMfaEnrollmentRequired,
	mockGetAccountUnauthorized,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { PASSWORD_RESET_REQUIRED_ERROR_NAME } from "@virtool/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInPasskey } = vi.hoisted(() => ({ signInPasskey: vi.fn() }));

vi.mock("@app/authClient", () => ({
	authClient: { signIn: { passkey: signInPasskey } },
}));

vi.mock("@simplewebauthn/browser", () => ({
	browserSupportsWebAuthnAutofill: async () => false,
	WebAuthnAbortService: { cancelCeremony: vi.fn() },
}));

describe("<LoginWall />", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function renderWall(path: string) {
		// Nobody is logged in, so the route guard's account fetch fails and the
		// wall renders instead of redirecting away.
		mockGetAccountUnauthorized();

		return renderRoute(path, {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});
	}

	it("tells a user whose session ended why they are back at the wall", async () => {
		await renderWall("/login?reason=session-ended");

		await waitFor(() => {
			expect(
				screen.getByText("Your session ended. Sign in again."),
			).toBeInTheDocument();
		});
	});

	it("drops the session notice once the password is accepted", async () => {
		authServerFnMocks.loginFn.mockResolvedValue({ twoFactorRedirect: true });
		const { router } = await renderWall(
			"/login?reason=session-ended&redirect=%2Fsamples",
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(
			await screen.findByLabelText("Authentication code"),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(router.state.location.search).toEqual({ redirect: "/samples" }),
		);
		expect(screen.queryByText(/session ended/i)).not.toBeInTheDocument();
	});

	it("says nothing about a session to a user who simply visits the wall", async () => {
		await renderWall("/login");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Sign in" }),
			).toBeInTheDocument();
		});
		expect(screen.queryByText(/session ended/i)).not.toBeInTheDocument();
	});

	it("sends a passkey user who must reset their password to the reset form", async () => {
		vi.stubGlobal("isSecureContext", true);
		vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
		mockGetPasswordPolicy();
		await renderWall("/login");
		signInPasskey.mockImplementation(async () => {
			userServerFnMocks.getAccountFn.mockRejectedValue(
				Object.assign(new Error("Password reset required"), {
					name: PASSWORD_RESET_REQUIRED_ERROR_NAME,
				}),
			);
			return { data: {}, error: null };
		});

		await userEvent.click(
			await screen.findByRole("button", { name: "Sign in with a passkey" }),
		);

		expect(await screen.findByText("Password Reset")).toBeInTheDocument();
	});

	it("tells a user that another browser already set up Virtool", async () => {
		await renderWall("/login?reason=setup-complete");

		expect(
			await screen.findByText(
				"Virtool is already set up. Sign in to continue.",
			),
		).toBeInTheDocument();
	});

	it("sends a user who must turn on two-factor authentication to enrollment", async () => {
		mockGetAccountMfaEnrollmentRequired();

		const { router } = await renderRoute("/login?redirect=%2Fsamples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/mfa-enrollment"),
		);
		expect(router.state.location.search).toEqual({ redirect: "/samples" });
	});
});
