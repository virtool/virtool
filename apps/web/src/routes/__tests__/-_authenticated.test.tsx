import { accountQueryKeys } from "@account/keys";
import { waitFor } from "@testing-library/react";
import { authServerFnMocks } from "@tests/server-fn/auth";
import {
	mockGetAccountMfaEnrollmentRequired,
	mockGetAccountUnauthorized,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { SETUP_REQUIRED_ERROR_NAME } from "@virtool/contracts";
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
});
