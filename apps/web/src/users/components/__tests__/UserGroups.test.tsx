import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeGroup } from "@tests/fake/groups";
import { createFakeUser } from "@tests/fake/user";
import { mockListGroups } from "@tests/server-fn/groups";
import { mockUpdateUser, userServerFnMocks } from "@tests/server-fn/users";
import { renderWithProviders, renderWithRouter } from "@tests/setup";
import type { Group } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import UserGroups from "../UserGroups";

describe("<UserGroups />", () => {
	let allGroups: Group[];
	let member: Group;
	let other: Group;
	let userId: number;

	beforeEach(() => {
		member = createFakeGroup({ id: 1, name: "foo" });
		other = createFakeGroup({ id: 2, name: "bar" });
		allGroups = [member, other];
		userId = createFakeUser().id;
	});

	it("renders members with primary toggles and remove buttons", async () => {
		mockListGroups(allGroups);

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member]}
				primaryGroup={member}
			/>,
		);

		expect(await screen.findByText("Groups")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Primary group: foo" }),
		).toHaveAttribute("aria-pressed", "true");
		expect(
			screen.getByRole("button", { name: "Remove foo" }),
		).toBeInTheDocument();
	});

	it("points to group creation when no groups exist", async () => {
		mockListGroups([]);

		await renderWithRouter(
			<UserGroups userId={userId} memberGroups={[]} primaryGroup={null} />,
		);

		expect(
			await screen.findByText(/No groups have been created yet/),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Manage groups" })).toHaveAttribute(
			"href",
			"/administration/groups",
		);
		expect(
			screen.queryByText("This user is not a member of any groups."),
		).not.toBeInTheDocument();
	});

	it("adds a group through the combobox", async () => {
		mockListGroups(allGroups);
		mockUpdateUser(userId, 200, {});

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member]}
				primaryGroup={member}
			/>,
		);

		await userEvent.click(
			await screen.findByRole("button", { name: "Toggle Add group menu" }),
		);
		await userEvent.click(screen.getByRole("option", { name: "bar" }));

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, groups: [1, 2] },
			}),
		);
	});

	it("sets the primary group when a toggle is pressed", async () => {
		mockListGroups(allGroups);
		mockUpdateUser(userId, 200, {});

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member, other]}
				primaryGroup={member}
			/>,
		);

		await userEvent.click(
			await screen.findByRole("button", { name: "Primary group: bar" }),
		);

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, primaryGroup: 2 },
			}),
		);
	});

	it("removes a group and clears the primary when the primary is removed", async () => {
		mockListGroups(allGroups);
		mockUpdateUser(userId, 200, {});

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member, other]}
				primaryGroup={member}
			/>,
		);

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove foo" }),
		);

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, groups: [2], primaryGroup: null },
			}),
		);
	});
});
