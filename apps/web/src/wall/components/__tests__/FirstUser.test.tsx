import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockCreateFirstUser } from "@tests/server-fn/auth";
import { mockGetRoot } from "@tests/server-fn/root";
import { mockGetAccount } from "@tests/server-fn/users";
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

		await userEvent.type(screen.getByLabelText("username"), account.handle);
		await userEvent.type(screen.getByLabelText("password"), "supersecret");
		await userEvent.click(screen.getByRole("button", { name: /Create User/i }));

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/");
		});
		expect(createFirstUser).toHaveBeenCalled();
	});

	it("shows an error and stays on /setup when creation fails", async () => {
		mockCreateFirstUser(undefined, 409);

		const { router } = await renderSetup();

		await userEvent.type(screen.getByLabelText("username"), "bob");
		await userEvent.type(screen.getByLabelText("password"), "supersecret");
		await userEvent.click(screen.getByRole("button", { name: /Create User/i }));

		expect(
			await screen.findByText("Virtool already has a user."),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/setup");
	});
});
