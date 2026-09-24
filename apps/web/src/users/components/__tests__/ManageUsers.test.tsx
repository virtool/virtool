import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeUsers } from "@tests/fake/user";
import { mockFindUsers, mockGetAccount } from "@tests/server-fn/users";
import { at, renderRoute, renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { ManageUsers } from "../ManageUsers";

describe("<ManageUsers />", () => {
	it("should render a table of users", async () => {
		const users = createFakeUsers(3);
		at(users, 0).administratorRole = "full";
		at(users, 1).lifecycleState = "pending";
		at(users, 2).active = false;
		const findUsers = mockFindUsers(users);
		const account = createFakeAccount({ administratorRole: "full" });

		await renderRoute("/administration/users", { account });

		expect(
			await screen.findByRole("heading", { name: "Users" }),
		).toBeInTheDocument();
		expect(await screen.findByLabelText("Search users")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
		expect(screen.getByText("3 users")).toBeInTheDocument();

		const rows = screen.getAllByRole("row").slice(1);
		expect(rows).toHaveLength(3);

		const first = within(at(rows, 0));
		expect(first.getByText(at(users, 0).handle)).toBeInTheDocument();
		expect(
			first.getByText(`${at(users, 0).handle}@example.com`),
		).toBeInTheDocument();
		expect(first.getByText("Full")).toBeInTheDocument();
		expect(first.getByText("Active")).toBeInTheDocument();

		const second = within(at(rows, 1));
		expect(second.getByText("No handle yet")).toBeInTheDocument();
		expect(
			second.getByRole("img", { name: "Invited user" }),
		).toBeInTheDocument();
		expect(second.getByText("Invited")).toBeInTheDocument();

		expect(within(at(rows, 2)).getByText("Deactivated")).toBeInTheDocument();

		expect(findUsers).toHaveBeenCalledWith({
			data: {
				direction: "ascending",
				page: 1,
				perPage: 25,
				roles: [],
				sort: "handle",
				statuses: [],
				term: "",
			},
		});
	});

	it("should sort by a column and reverse on a second click", async () => {
		mockFindUsers(createFakeUsers(2));
		const account = createFakeAccount({ administratorRole: "full" });

		const { router } = await renderRoute("/administration/users", {
			account,
		});

		await userEvent.click(await screen.findByRole("button", { name: "Email" }));
		expect(router.state.location.search).toMatchObject({
			sort: "email",
			direction: "ascending",
		});

		await userEvent.click(await screen.findByRole("button", { name: "Email" }));
		expect(router.state.location.search).toMatchObject({
			sort: "email",
			direction: "descending",
		});
	});

	it("should filter by status", async () => {
		const findUsers = mockFindUsers(createFakeUsers(2));
		const account = createFakeAccount({ administratorRole: "full" });

		await renderRoute("/administration/users?statuses=invited", { account });

		expect(
			await screen.findByRole("button", {
				name: "Remove Invited status filter",
			}),
		).toBeInTheDocument();
		expect(findUsers).toHaveBeenCalledWith({
			data: expect.objectContaining({ statuses: ["invited"] }),
		});
	});

	// Rendered directly rather than through the route: `/administration`'s
	// `beforeLoad` redirects an account without the role away before this branch
	// could render. It holds no list query, so nothing suspends.
	it("should render correctly if account has insufficient permissions", async () => {
		const users = createFakeUsers(3);

		mockFindUsers(users);
		mockGetAccount(createFakeAccount({ administratorRole: null }));

		await renderWithRouter(
			<ManageUsers
				perPage={25}
				search={{
					direction: "ascending",
					page: 1,
					roles: [],
					sort: "handle",
					statuses: [],
					term: "",
				}}
				setSearch={() => {}}
			/>,
		);

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
	});
});
