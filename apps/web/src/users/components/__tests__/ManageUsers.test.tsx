import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeUsers } from "@tests/fake/user";
import { mockFindUsers, mockGetAccount } from "@tests/server-fn/users";
import { at, renderRoute, renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { ManageUsers } from "../ManageUsers";

describe("<ManageUsers />", () => {
	it("should render correctly with 3 users", async () => {
		const users = createFakeUsers(3);
		at(users, 0).administratorRole = "full";
		mockFindUsers(users);
		const account = createFakeAccount({ administratorRole: "full" });

		await renderRoute("/administration/users", { account });

		expect(await screen.findByLabelText("Search users")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
		expect(await screen.findByText(/Administrator/)).toBeInTheDocument();
		users.forEach((user) => {
			expect(screen.getByText(user.handle)).toBeInTheDocument();
		});
	});

	// Rendered directly rather than through the route: `/administration`'s
	// `beforeLoad` redirects an account without the role away before this branch
	// could render. It holds no list query, so nothing suspends.
	it("should render correctly if account has insufficient permissions", async () => {
		const users = createFakeUsers(3);

		mockFindUsers(users);
		mockGetAccount(createFakeAccount({ administratorRole: null }));

		await renderWithRouter(<ManageUsers />);

		expect(
			await screen.findByText("You do not have permission to manage users."),
		).toBeInTheDocument();
		expect(screen.getByText("Contact an administrator.")).toBeInTheDocument();
		for (const user of users) {
			expect(screen.queryByText(user.handle)).not.toBeInTheDocument();
		}
		expect(
			screen.queryByRole("button", { name: "Create" }),
		).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Search users")).not.toBeInTheDocument();
		expect(screen.queryByText("Administrator")).not.toBeInTheDocument();
	});
});
