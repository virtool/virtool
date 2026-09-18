import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { mockGetAccountUnauthorized } from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { expect, it } from "vitest";

it("submits an address and waits for the mailbox challenge", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({ email: "" });
	authServerFnMocks.submitEmailRemediationFn.mockResolvedValue({
		complete: false,
	});
	await renderRoute("/email-remediation");

	await userEvent.type(
		await screen.findByLabelText("Email address"),
		"alice@example.com",
	);
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));

	expect(
		await screen.findByText(/Check your email and open the verification link/),
	).toBeInTheDocument();
	expect(authServerFnMocks.submitEmailRemediationFn).toHaveBeenCalledWith({
		data: { email: "alice@example.com", redirect: undefined },
	});
});

it("resumes a staged address and can cancel the restricted session", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
		email: "alice@example.com",
	});
	authServerFnMocks.logoutFn.mockResolvedValue(null);
	mockGetAccountUnauthorized();
	const { queryClient, router } = await renderRoute("/email-remediation");

	expect(await screen.findByLabelText("Email address")).toHaveValue(
		"alice@example.com",
	);
	await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

	expect(authServerFnMocks.logoutFn).toHaveBeenCalledOnce();
	await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
	expect(queryClient.getQueryData(["email-remediation"])).toEqual({
		email: "",
	});
});

it("returns to the requested page after offline remediation", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({ email: "" });
	authServerFnMocks.submitEmailRemediationFn.mockResolvedValue({
		complete: true,
	});
	const { router } = await renderRoute(
		"/email-remediation?redirect=%2Fsamples",
	);

	await userEvent.type(
		await screen.findByLabelText("Email address"),
		"alice@example.com",
	);
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));

	await waitFor(() => expect(router.state.location.pathname).toBe("/samples"));
	expect(authServerFnMocks.submitEmailRemediationFn).toHaveBeenCalledWith({
		data: { email: "alice@example.com", redirect: "/samples" },
	});
});

it.each(["", "abc", "g".repeat(64), "a".repeat(63), "a".repeat(65)])(
	"shows the retry form for malformed verification token %s",
	async (token) => {
		authServerFnMocks.getEmailRemediationFn.mockResolvedValue({ email: "" });
		const { router } = await renderRoute(
			`/email-remediation-verify?token=${token}&redirect=%2Fsamples`,
		);

		expect(await screen.findByLabelText("Email address")).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/email-remediation");
		expect(router.state.location.search).toEqual({
			error: "invalid-link",
			redirect: "/samples",
		});
		expect(authServerFnMocks.completeEmailRemediationFn).not.toHaveBeenCalled();
	},
);
