import { accountQueryKeys } from "@account/keys";
import { screen, waitFor } from "@testing-library/react";
import { userServerFnMocks } from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { CLIENT_ERROR_NAME, UNAVAILABLE_MESSAGE } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

describe("/login", () => {
	it("shows the outage rather than the sign-in form while the database is down", async () => {
		userServerFnMocks.getAccountFn.mockRejectedValue(
			Object.assign(new Error(UNAVAILABLE_MESSAGE), {
				name: CLIENT_ERROR_NAME,
				status: 503,
			}),
		);

		await renderRoute("/login", {
			seed: (queryClient) => {
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			},
		});

		await waitFor(() => {
			expect(
				screen.getByText("Virtool is temporarily unavailable"),
			).toBeInTheDocument();
		});
		expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
	});
});
