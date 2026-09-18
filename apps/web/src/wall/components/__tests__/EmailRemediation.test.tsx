import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { mockGetAccountUnauthorized } from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { expect, it } from "vitest";

const pendingState = {
	status: "pending" as const,
	maskedEmail: "a***e@example.com",
	expiresAt: new Date("2026-09-21T00:00:00Z"),
	resendAt: new Date("2026-09-18T00:01:00Z"),
	canResend: true,
	deliveryFailed: false,
};

it("submits an address and persists the mailbox challenge state", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
		status: "input",
	});
	authServerFnMocks.submitEmailRemediationFn.mockResolvedValue({
		complete: false,
		state: pendingState,
	});
	const { queryClient } = await renderRoute("/email-remediation");

	await userEvent.type(
		await screen.findByLabelText("Email address"),
		"alice@example.com",
	);
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));

	expect(await screen.findByText(/a\*\*\*e@example.com/)).toBeInTheDocument();
	expect(queryClient.getQueryData(["email-remediation"])).toEqual(pendingState);
	expect(authServerFnMocks.submitEmailRemediationFn).toHaveBeenCalledWith({
		data: { email: "alice@example.com", redirect: undefined },
	});
});

it("resumes pending verification with resend, change, and cancel actions", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue(pendingState);
	authServerFnMocks.resendEmailRemediationFn.mockResolvedValue({
		complete: false,
		state: { ...pendingState, canResend: false },
	});
	await renderRoute("/email-remediation?redirect=%2Fsamples");

	expect(await screen.findByText(/a\*\*\*e@example.com/)).toBeInTheDocument();
	await userEvent.click(screen.getByRole("button", { name: "Resend" }));
	expect(authServerFnMocks.resendEmailRemediationFn).toHaveBeenCalledWith({
		data: { redirect: "/samples" },
	});
	expect(screen.getByRole("button", { name: "Resend" })).toBeDisabled();
});

it("offers recovery when delivery is exhausted", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
		...pendingState,
		deliveryFailed: true,
	});
	await renderRoute("/email-remediation");

	expect(
		await screen.findByText(/message could not be sent/i),
	).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Resend" })).toBeEnabled();
	expect(screen.getByRole("button", { name: "Change email" })).toBeEnabled();
});

it("returns to address entry and supersedes the pending link", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue(pendingState);
	authServerFnMocks.changeEmailRemediationFn.mockResolvedValue({
		status: "input",
	});
	await renderRoute("/email-remediation");

	await userEvent.click(
		await screen.findByRole("button", { name: "Change email" }),
	);
	expect(await screen.findByLabelText("Email address")).toBeInTheDocument();
	expect(authServerFnMocks.changeEmailRemediationFn).toHaveBeenCalledOnce();
});

it("cancels pending remediation and returns to login", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue(pendingState);
	authServerFnMocks.cancelEmailRemediationFn.mockResolvedValue(null);
	mockGetAccountUnauthorized();
	const { router } = await renderRoute("/email-remediation");

	await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
	expect(authServerFnMocks.cancelEmailRemediationFn).toHaveBeenCalledOnce();
	await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
});

it("promotes the initiating browser after verification elsewhere", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
		status: "verified",
	});
	authServerFnMocks.promoteEmailRemediationFn.mockResolvedValue({
		complete: true,
	});
	const { router } = await renderRoute(
		"/email-remediation?redirect=%2Fsamples",
	);

	expect(await screen.findByText("Email verified")).toBeInTheDocument();
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(router.state.location.pathname).toBe("/samples"));
	expect(authServerFnMocks.promoteEmailRemediationFn).toHaveBeenCalledOnce();
});

it("returns to the requested page after offline remediation", async () => {
	authServerFnMocks.getEmailRemediationFn.mockResolvedValue({
		status: "input",
	});
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
});

it("scrubs the token and shows a cross-browser verification result", async () => {
	const token = "a".repeat(64);
	window.history.replaceState(
		{},
		"",
		`/email-remediation-verify#token=${token}&redirect=%2Fsamples`,
	);
	authServerFnMocks.completeEmailRemediationFn.mockResolvedValue({
		status: "verified",
		authenticated: false,
		canRetry: false,
	});
	const { router } = await renderRoute("/email-remediation-verify");

	expect(await screen.findByText("Email verified")).toBeInTheDocument();
	expect(window.location.hash).toBe("");
	expect(window.location.href).not.toContain(token);
	expect(authServerFnMocks.completeEmailRemediationFn).toHaveBeenCalledWith({
		data: { token },
	});
	await userEvent.click(screen.getByRole("button", { name: "Log in" }));
	await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
	expect(router.state.location.search).toEqual({ redirect: "/samples" });
});

it("waits for explicit Continue after same-browser verification", async () => {
	const token = "b".repeat(64);
	window.history.replaceState(
		{},
		"",
		`/email-remediation-verify#token=${token}&redirect=%2Fsamples`,
	);
	authServerFnMocks.completeEmailRemediationFn.mockResolvedValue({
		status: "verified",
		authenticated: true,
		canRetry: false,
	});
	const { router } = await renderRoute("/email-remediation-verify");

	expect(await screen.findByText("Email verified")).toBeInTheDocument();
	expect(router.state.location.pathname).toBe("/email-remediation-verify");
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(router.state.location.pathname).toBe("/samples"));
});

it("accepts and scrubs a legacy query-based verification link", async () => {
	const token = "c".repeat(64);
	window.history.replaceState(
		{},
		"",
		`/email-remediation-verify?token=${token}&redirect=%2Fsamples`,
	);
	authServerFnMocks.completeEmailRemediationFn.mockResolvedValue({
		status: "verified",
		authenticated: false,
		canRetry: false,
	});
	await renderRoute("/email-remediation-verify");

	expect(await screen.findByText("Email verified")).toBeInTheDocument();
	expect(window.location.search).toBe("");
	expect(window.location.href).not.toContain(token);
	expect(authServerFnMocks.completeEmailRemediationFn).toHaveBeenCalledWith({
		data: { token },
	});
});

it("retries an interrupted verification without restoring the token to the URL", async () => {
	const token = "d".repeat(64);
	window.history.replaceState(
		{},
		"",
		`/email-remediation-verify#token=${token}`,
	);
	authServerFnMocks.completeEmailRemediationFn
		.mockRejectedValueOnce(new Error("network interrupted"))
		.mockResolvedValueOnce({
			status: "verified",
			authenticated: false,
			canRetry: false,
		});
	await renderRoute("/email-remediation-verify");

	expect(
		await screen.findByText("Verification interrupted"),
	).toBeInTheDocument();
	expect(window.location.href).not.toContain(token);
	await userEvent.click(screen.getByRole("button", { name: "Try again" }));
	expect(await screen.findByText("Email verified")).toBeInTheDocument();
	expect(authServerFnMocks.completeEmailRemediationFn).toHaveBeenCalledTimes(2);
});

it("shows a safe result for a malformed fragment token", async () => {
	window.history.replaceState(
		{},
		"",
		"/email-remediation-verify#token=invalid",
	);
	await renderRoute("/email-remediation-verify");

	expect(
		await screen.findByText("This verification link cannot be used."),
	).toBeInTheDocument();
	expect(window.location.hash).toBe("");
	expect(authServerFnMocks.completeEmailRemediationFn).not.toHaveBeenCalled();
});
