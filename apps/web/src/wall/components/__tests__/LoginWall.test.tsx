import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockGetPasswordPolicy } from "@tests/server-fn/settings";
import {
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
				screen.getByText("Your session ended. Please log in again."),
			).toBeInTheDocument();
		});
	});

	it("says nothing about a session to a user who simply visits the wall", async () => {
		await renderWall("/login");

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
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
});
