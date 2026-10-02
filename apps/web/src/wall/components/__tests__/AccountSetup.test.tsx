import { accountQueryKeys } from "@account/keys";
import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { authServerFnMocks, createClientError } from "@tests/server-fn/auth";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { rootQueryKeys } from "@wall/keys";
import { beforeEach, expect, it, vi } from "vitest";
import AccountSetup from "../AccountSetup";

const token = "a".repeat(64);

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState({}, "", "/");
	mockGetAccount(createFakeAccount());
});

function mockUsableInvitation() {
	window.history.replaceState({}, "", `/account-setup#token=${token}`);
	authServerFnMocks.inspectAccountSetupFn.mockResolvedValue({
		status: "valid",
		email: "ada@example.com",
		expiresAt: new Date("2026-10-09T12:00:00Z"),
	});
}

async function fillForm(confirmPassword = "a-real-password") {
	await userEvent.type(screen.getByLabelText("Username"), "Ada");
	await userEvent.type(screen.getByLabelText("Password"), "a-real-password");
	await userEvent.type(
		screen.getByLabelText("Confirm password"),
		confirmPassword,
	);
	await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

it("scrubs, inspects, and accepts a usable invitation", async () => {
	mockUsableInvitation();
	authServerFnMocks.acceptAccountSetupFn.mockResolvedValue({
		emailVerificationRequired: false,
		nextRoute: "/",
	});

	const removeQueries = vi.spyOn(QueryClient.prototype, "removeQueries");
	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Set up your account" });
	expect(window.location.hash).toBe("");
	expect(
		screen.getByText("This link works one time and expires on 2026-10-09."),
	).toBeInTheDocument();

	await fillForm();

	expect(authServerFnMocks.acceptAccountSetupFn).toHaveBeenCalledWith({
		data: { token, handle: "Ada", password: "a-real-password" },
	});
	await waitFor(() =>
		expect(removeQueries).toHaveBeenCalledWith({
			queryKey: accountQueryKeys.all(),
		}),
	);
	expect(removeQueries).toHaveBeenCalledWith({
		queryKey: rootQueryKeys.all(),
	});
});

it("refuses mismatched passwords before submitting", async () => {
	mockUsableInvitation();

	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Set up your account" });
	await fillForm("something-else");

	expect(
		await screen.findByText("The passwords do not match"),
	).toBeInTheDocument();
	expect(authServerFnMocks.acceptAccountSetupFn).not.toHaveBeenCalled();
});

it("says a verification email is on its way when the server queued one", async () => {
	mockUsableInvitation();
	authServerFnMocks.acceptAccountSetupFn.mockResolvedValue({
		emailVerificationRequired: true,
		nextRoute: "/",
	});

	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Set up your account" });
	await fillForm();

	expect(
		await screen.findByRole("heading", { name: "Check your email" }),
	).toBeInTheDocument();
	expect(
		screen.getByText(
			"Your account is ready. A link to verify ada@example.com is on its way.",
		),
	).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Continue to Virtool" }),
	).toBeInTheDocument();
});

it("keeps the form and shows the server's message for a taken username", async () => {
	mockUsableInvitation();
	authServerFnMocks.acceptAccountSetupFn.mockRejectedValue(
		createClientError("This username is already taken.", 409),
	);

	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Set up your account" });
	await fillForm();

	expect(
		await screen.findByText("This username is already taken."),
	).toHaveAttribute("role", "alert");
	expect(screen.getByLabelText("Username")).toHaveValue("Ada");
});

it("hides an unexpected error behind a generic message", async () => {
	mockUsableInvitation();
	authServerFnMocks.acceptAccountSetupFn.mockRejectedValue(
		new Error("relation users does not exist"),
	);

	await renderWithRouter(<AccountSetup />, "/account-setup");
	await screen.findByRole("heading", { name: "Set up your account" });
	await fillForm();

	expect(
		await screen.findByText("Account setup failed. Try again."),
	).toHaveAttribute("role", "alert");
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
	expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
		"href",
		"/login",
	);
});

it("does not ask the server about a malformed token", async () => {
	window.history.replaceState({}, "", "/account-setup#token=not-a-token");

	await renderWithRouter(<AccountSetup />, "/account-setup");
	expect(
		await screen.findByRole("heading", { name: "Invitation unavailable" }),
	).toBeInTheDocument();
	expect(window.location.hash).toBe("");
	expect(authServerFnMocks.inspectAccountSetupFn).not.toHaveBeenCalled();
});
