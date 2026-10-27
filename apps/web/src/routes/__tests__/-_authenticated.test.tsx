import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { authServerFnMocks } from "@tests/server-fn/auth";
import {
	mockGetAccount,
	mockGetAccountMfaEnrollmentRequired,
	mockGetAccountUnauthorized,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import {
	CLIENT_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";

describe("<AuthenticatedLayout />", () => {
	it("redirects /home to the dashboard", async () => {
		const { router } = await renderRoute("/home");

		expect(router.state.location.pathname).toBe("/");
	});

	it("redirects to /login when the account is not authenticated", async () => {
		mockGetAccountUnauthorized();

		const { router } = await renderRoute("/samples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/login");
		});
		expect(router.state.location.search).toMatchObject({
			redirect: "/samples",
		});
	});

	it("keeps a user who must turn on two-factor authentication out of the app", async () => {
		mockGetAccountMfaEnrollmentRequired();

		const { router } = await renderRoute("/samples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/mfa-enrollment");
		});
		expect(router.state.location.search).toEqual({ redirect: "/samples" });
		expect(document.querySelector("nav[aria-label='Primary']")).toBeNull();
	});

	it("keeps a user in email remediation out of the app", async () => {
		authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
			status: "input",
		});
		userServerFnMocks.getAccountFn.mockRejectedValue(
			Object.assign(new Error("Setup required"), {
				name: SETUP_REQUIRED_ERROR_NAME,
				purpose: "email_remediation",
			}),
		);

		const { router } = await renderRoute("/samples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/email-remediation");
		});
	});

	it("keeps a signed-in user in place while the database is down", async () => {
		userServerFnMocks.getAccountFn.mockRejectedValue(
			Object.assign(new Error("Virtool is temporarily unavailable."), {
				name: CLIENT_ERROR_NAME,
				status: 503,
			}),
		);

		const { router } = await renderRoute("/samples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(
				screen.getByText("Virtool is temporarily unavailable"),
			).toBeInTheDocument();
		});
		expect(router.state.location.pathname).toBe("/samples");
	});

	it("offers a retry instead of the login page when the account fetch fails", async () => {
		mockGetAccount(createFakeAccount()).mockRejectedValueOnce(
			new TypeError("Failed to fetch"),
		);

		const { router } = await renderRoute("/samples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		const retry = await screen.findByRole("button", { name: "Try again" });
		expect(router.state.location.pathname).toBe("/samples");

		await userEvent.click(retry);

		await waitFor(() => {
			expect(
				document.querySelector("nav[aria-label='Primary']"),
			).not.toBeNull();
		});
		expect(router.state.location.pathname).toBe("/samples");
	});
});
