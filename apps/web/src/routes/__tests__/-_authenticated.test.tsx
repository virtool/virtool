import { accountQueryKeys } from "@account/keys";
import { waitFor } from "@testing-library/react";
import { mockGetAccountUnauthorized } from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<AuthenticatedLayout />", () => {
	it("redirects to /login when the account is not authenticated", async () => {
		mockGetAccountUnauthorized();

		const { router } = await renderRoute("/samples", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/login");
		});
		expect(router.state.location.search).toMatchObject({
			redirect: "/samples",
		});
	});
});
