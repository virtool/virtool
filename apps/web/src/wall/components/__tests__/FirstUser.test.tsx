import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { authServerFnMocks, mockCreateFirstUser } from "@tests/server-fn/auth";
import { mockGetRoot } from "@tests/server-fn/root";
import {
	mockGetAccount,
	mockGetAccountUnauthorized,
} from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<FirstUser />", () => {
	async function renderSetup() {
		return renderRoute("/setup", {
			seed: (queryClient) => {
				// A fresh instance: the root reports the setup is needed and no
				// account has been fetched yet.
				queryClient.setQueryData(["root"], { firstUser: true });
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});
	}

	async function fillForm(confirmPassword = "supersecret") {
		await userEvent.type(await screen.findByLabelText("Username"), "alice");
		await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
		await userEvent.type(screen.getByLabelText("Password"), "supersecret");
		await userEvent.type(
			screen.getByLabelText("Confirm password"),
			confirmPassword,
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Create administrator" }),
		);
	}

	it("creates the first user and lands in the authenticated app", async () => {
		const account = createFakeAccount();
		const createFirstUser = mockCreateFirstUser({
			id: account.id,
			handle: account.handle,
		});

		// After setup the root reports no first user, and the session created by
		// the server function authenticates the account fetch, so the guard
		// admits the user instead of bouncing back to /setup.
		mockGetRoot({ firstUser: false });
		mockGetAccount(account);

		const { router } = await renderSetup();
		await fillForm();

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/");
		});
		expect(createFirstUser).toHaveBeenCalledWith({
			data: {
				handle: "alice",
				email: "alice@example.com",
				password: "supersecret",
			},
		});
	});

	it("refuses mismatched passwords before submitting", async () => {
		const createFirstUser = mockCreateFirstUser();

		await renderSetup();
		await fillForm("different");

		expect(
			await screen.findByText("The passwords do not match"),
		).toBeInTheDocument();
		expect(createFirstUser).not.toHaveBeenCalled();
	});

	it("says a verification email is on its way before entering the app", async () => {
		const account = createFakeAccount();
		authServerFnMocks.createFirstUserFn.mockResolvedValue({
			user: account,
			emailVerificationRequired: true,
		});
		mockGetRoot({ firstUser: false });
		mockGetAccount(account);

		const { router } = await renderSetup();
		await fillForm();

		expect(
			await screen.findByRole("heading", { name: "Check your email" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/setup");

		await userEvent.click(
			screen.getByRole("button", { name: "Continue to Virtool" }),
		);
		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/");
		});
	});

	it("sends the user to sign in when another browser finished setup first", async () => {
		mockCreateFirstUser(undefined, 409);
		mockGetAccountUnauthorized();

		const { router } = await renderSetup();
		await fillForm();

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/login");
		});
		expect(
			await screen.findByText(
				"Virtool is already set up. Sign in to continue.",
			),
		).toBeInTheDocument();
	});

	it("shows a server refusal next to the form", async () => {
		mockCreateFirstUser(undefined, 400, "Enter a valid email address.");

		const { router } = await renderSetup();
		await fillForm();

		expect(
			await screen.findByText("Enter a valid email address."),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/setup");
	});

	it("is gone once a user exists", async () => {
		mockGetAccountUnauthorized();

		const { router } = await renderRoute("/setup", {
			seed: (queryClient) => {
				queryClient.setQueryData(["root"], { firstUser: false });
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/login");
		});
	});
});
