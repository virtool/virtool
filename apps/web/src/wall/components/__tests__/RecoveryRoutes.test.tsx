import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { recoveryServerFnMocks } from "@tests/server-fn/recovery";
import { renderWithRouter } from "@tests/setup";
import { UNAUTHORIZED_ERROR_NAME } from "@virtool/contracts";
import EmailVerificationWall from "@wall/components/EmailVerificationWall";
import RecoveryWall from "@wall/components/RecoveryWall";
import { beforeEach, expect, it, vi } from "vitest";

const token = "a".repeat(64);

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState({}, "", "/");
	window.sessionStorage.clear();
});

it("removes a recovery bearer token before inspecting it", async () => {
	window.history.replaceState(
		{},
		"",
		`/recover#token=${token}&purpose=password_recovery`,
	);
	let requestUrl = "";
	recoveryServerFnMocks.inspectPasswordRecoveryFn.mockImplementation(
		async () => {
			requestUrl = window.location.href;
			return { status: "usable" };
		},
	);

	await renderWithRouter(<RecoveryWall />, "/recover");
	await screen.findByRole("heading", { name: "Choose a new password" });

	expect(requestUrl).toBe("http://localhost:3000/recover");
	expect(window.location.hash).toBe("");
	expect(window.location.search).toBe("");
	expect(recoveryServerFnMocks.inspectPasswordRecoveryFn).toHaveBeenCalledWith({
		data: { token, purpose: "password_recovery" },
	});
});

it("removes a verification bearer token before inspecting it", async () => {
	window.history.replaceState({}, "", `/verify-email?token=${token}`);
	let requestUrl = "";
	recoveryServerFnMocks.inspectEmailVerificationFn.mockImplementation(
		async () => {
			requestUrl = window.location.href;
			return { status: "current" };
		},
	);
	recoveryServerFnMocks.verifyCurrentEmailFn.mockResolvedValue({
		status: "verified",
	});

	await renderWithRouter(<EmailVerificationWall />, "/verify-email");
	await screen.findByRole("heading", { name: "Email verified" });

	expect(requestUrl).toBe("http://localhost:3000/verify-email");
	expect(window.location.search).toBe("");
	expect(recoveryServerFnMocks.verifyCurrentEmailFn).toHaveBeenCalledWith({
		data: { token },
	});
});

it("keeps a signed-out email-change link for after sign-in", async () => {
	window.history.replaceState({}, "", `/verify-email?token=${token}`);
	recoveryServerFnMocks.inspectEmailVerificationFn.mockResolvedValue({
		status: "change",
	});
	recoveryServerFnMocks.completeAccountEmailChangeFn.mockRejectedValue(
		Object.assign(new Error("Unauthorized"), { name: UNAUTHORIZED_ERROR_NAME }),
	);

	await renderWithRouter(<EmailVerificationWall />, "/verify-email");
	await screen.findByRole("heading", { name: "Sign in to change your email" });

	expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
		"href",
		"/login?redirect=%2Fverify-email",
	);
	expect(window.sessionStorage.getItem("vt-pending-email-change")).toBe(token);
});

it("completes a kept email-change link after sign-in", async () => {
	window.sessionStorage.setItem("vt-pending-email-change", token);
	window.history.replaceState({}, "", "/verify-email");
	recoveryServerFnMocks.inspectEmailVerificationFn.mockResolvedValue({
		status: "change",
	});
	recoveryServerFnMocks.completeAccountEmailChangeFn.mockResolvedValue({
		status: "verified",
	});

	await renderWithRouter(<EmailVerificationWall />, "/verify-email");
	await screen.findByRole("heading", { name: "Email verified" });

	expect(
		recoveryServerFnMocks.completeAccountEmailChangeFn,
	).toHaveBeenCalledWith({ data: { token } });
	expect(window.sessionStorage.getItem("vt-pending-email-change")).toBeNull();
});

it("keeps a resumed email-change link when verification is interrupted", async () => {
	window.sessionStorage.setItem("vt-pending-email-change", token);
	window.history.replaceState({}, "", "/verify-email");
	recoveryServerFnMocks.inspectEmailVerificationFn.mockRejectedValue(
		new Error("Network error"),
	);

	await renderWithRouter(<EmailVerificationWall />, "/verify-email");
	await screen.findByRole("heading", { name: "Verification interrupted" });

	expect(window.sessionStorage.getItem("vt-pending-email-change")).toBe(token);
});

it("drops a kept email-change link when another link is opened", async () => {
	const otherToken = "b".repeat(64);
	window.sessionStorage.setItem("vt-pending-email-change", token);
	window.history.replaceState({}, "", `/verify-email?token=${otherToken}`);
	recoveryServerFnMocks.inspectEmailVerificationFn.mockRejectedValue(
		new Error("Network error"),
	);

	await renderWithRouter(<EmailVerificationWall />, "/verify-email");
	await screen.findByRole("heading", { name: "Verification interrupted" });

	expect(recoveryServerFnMocks.inspectEmailVerificationFn).toHaveBeenCalledWith(
		{
			data: { token: otherToken },
		},
	);
	expect(window.sessionStorage.getItem("vt-pending-email-change")).toBeNull();
});

it("refuses mismatched passwords before consuming the recovery link", async () => {
	window.history.replaceState(
		{},
		"",
		`/recover#token=${token}&purpose=password_recovery`,
	);
	recoveryServerFnMocks.inspectPasswordRecoveryFn.mockResolvedValue({
		status: "usable",
	});

	await renderWithRouter(<RecoveryWall />, "/recover");
	await screen.findByRole("heading", { name: "Choose a new password" });
	await userEvent.type(screen.getByLabelText("New password"), "a-new-password");
	await userEvent.type(
		screen.getByLabelText("Confirm new password"),
		"another-password",
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Change password" }),
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"The passwords do not match.",
	);
	expect(
		recoveryServerFnMocks.completePasswordRecoveryFn,
	).not.toHaveBeenCalled();
});

it("shows the same acknowledgement whatever the account", async () => {
	recoveryServerFnMocks.requestPasswordRecoveryFn.mockResolvedValue({
		status: "accepted",
	});

	await renderWithRouter(<RecoveryWall />, "/recover");
	await userEvent.type(
		await screen.findByLabelText("Username"),
		"nobody-by-this-name",
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Send recovery link" }),
	);

	expect(
		await screen.findByRole("heading", { name: "Check your email" }),
	).toBeInTheDocument();
	expect(
		screen.getByText(
			"If this account can receive recovery email, a link has been queued.",
		),
	).toBeInTheDocument();
});
