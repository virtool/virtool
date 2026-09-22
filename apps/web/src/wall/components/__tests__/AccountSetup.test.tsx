import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { renderWithRouter } from "@tests/setup";
import { beforeEach, expect, it, vi } from "vitest";
import AccountSetup from "../AccountSetup";

const token = "a".repeat(64);

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState({}, "", "/");
});

it("scrubs, inspects, and accepts a usable invitation", async () => {
	window.history.replaceState({}, "", `/account-setup#token=${token}`);
	authServerFnMocks.inspectAccountSetupFn.mockResolvedValue({
		status: "valid",
		handle: "Ada",
		email: "ada@example.com",
		expiresAt: new Date(Date.now() + 60_000),
	});
	authServerFnMocks.acceptAccountSetupFn.mockResolvedValue({ nextRoute: "/" });

	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Welcome, Ada" });
	expect(window.location.hash).toBe("");
	await userEvent.type(screen.getByLabelText("Password"), "a-real-password");
	await userEvent.click(screen.getByRole("button", { name: "Create account" }));
	expect(authServerFnMocks.acceptAccountSetupFn).toHaveBeenCalledWith({
		data: { token, password: "a-real-password" },
	});
});

it("uses one public state for an unusable invitation", async () => {
	window.history.replaceState({}, "", `/account-setup#token=${token}`);
	authServerFnMocks.inspectAccountSetupFn.mockResolvedValue({
		status: "unusable",
	});

	await renderWithRouter(<AccountSetup />, "/account-setup");
	expect(
		await screen.findByRole("heading", { name: "Invitation unavailable" }),
	).toBeInTheDocument();
});
