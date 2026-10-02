import { accountQueryKeys } from "@account/keys";
import { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { renderWithRouter } from "@tests/setup";
import { rootQueryKeys } from "@wall/keys";
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
		email: "ada@example.com",
		expiresAt: new Date(Date.now() + 60_000),
	});
	authServerFnMocks.acceptAccountSetupFn.mockResolvedValue({ nextRoute: "/" });

	const removeQueries = vi.spyOn(QueryClient.prototype, "removeQueries");
	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Set up your account" });
	expect(window.location.hash).toBe("");
	await userEvent.type(screen.getByLabelText("Username"), "Ada");
	await userEvent.type(screen.getByLabelText("Password"), "a-real-password");
	await userEvent.click(screen.getByRole("button", { name: "Create account" }));
	expect(authServerFnMocks.acceptAccountSetupFn).toHaveBeenCalledWith({
		data: { token, handle: "Ada", password: "a-real-password" },
	});
	expect(removeQueries).toHaveBeenCalledWith({
		queryKey: rootQueryKeys.all(),
	});
	expect(removeQueries).toHaveBeenCalledWith({
		queryKey: accountQueryKeys.all(),
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
