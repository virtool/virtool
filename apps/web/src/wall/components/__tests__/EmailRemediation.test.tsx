import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
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
		data: { email: "alice@example.com" },
	});
});

it("resumes a staged address and can cancel the restricted session", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
		email: "alice@example.com",
	});
	authServerFnMocks.logoutFn.mockResolvedValue(null);
	const { router } = await renderRoute("/email-remediation");

	expect(await screen.findByLabelText("Email address")).toHaveValue(
		"alice@example.com",
	);
	await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

	expect(authServerFnMocks.logoutFn).toHaveBeenCalledOnce();
	expect(router.state.location.pathname).toBe("/login");
});
