import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
import {
	mockGetAccountMfaEnrollmentRequired,
	mockGetAccountUnauthorized,
} from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
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

	const SESSION_ENDED = "Your session ended. Sign in again.";
	const SETUP_COMPLETE = "Virtool is already set up. Sign in to continue.";

	it.each([
		["session-ended", SESSION_ENDED],
		["setup-complete", SETUP_COMPLETE],
		[undefined, undefined],
	])(
		"explains why the user is at the wall when reason=%s",
		async (reason, notice) => {
			await renderWall(reason ? `/login?reason=${reason}` : "/login");

			expect(
				await screen.findByRole("button", { name: "Sign in" }),
			).toBeInTheDocument();
			for (const text of [SESSION_ENDED, SETUP_COMPLETE]) {
				if (text === notice) {
					expect(screen.getByText(text)).toBeInTheDocument();
				} else {
					expect(screen.queryByText(text)).not.toBeInTheDocument();
				}
			}
		},
	);

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
