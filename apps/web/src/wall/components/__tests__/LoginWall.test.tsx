import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import { mockGetAccountUnauthorized } from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<LoginWall />", () => {
	async function renderWall(path: string) {
		// Nobody is logged in, so the route guard's account fetch fails and the
		// wall renders instead of redirecting away.
		mockGetAccountUnauthorized();

		return renderRoute(path, {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});
	}

	it("tells a user whose session ended why they are back at the wall", async () => {
		await renderWall("/login?reason=session-ended");

		await waitFor(() => {
			expect(
				screen.getByText("Your session ended. Please log in again."),
			).toBeInTheDocument();
		});
	});

	it("says nothing about a session to a user who simply visits the wall", async () => {
		await renderWall("/login");

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
		});
		expect(screen.queryByText(/session ended/i)).not.toBeInTheDocument();
	});
});
