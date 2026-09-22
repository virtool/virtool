import { screen } from "@testing-library/react";
import { recoveryServerFnMocks } from "@tests/server-fn/recovery";
import { renderWithRouter } from "@tests/setup";
import EmailVerificationWall from "@wall/components/EmailVerificationWall";
import RecoveryWall from "@wall/components/RecoveryWall";
import { beforeEach, expect, it, vi } from "vitest";

const token = "a".repeat(64);

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState({}, "", "/");
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
