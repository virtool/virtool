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

	it("renders members as radios with remove buttons", async () => {
		mockListGroups(allGroups);

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member]}
				primaryGroup={member}
			/>,
		);

		expect(await screen.findByText("Groups")).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "foo" })).toBeChecked();
		expect(
			screen.getByRole("button", { name: "Remove foo" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: "No primary group" }),
		).not.toBeChecked();
	});

	it("shows an empty message when the user has no groups", async () => {
		mockListGroups(allGroups);

		renderWithProviders(
			<UserGroups userId={userId} memberGroups={[]} primaryGroup={null} />,
		);

		expect(
			await screen.findByText("This user is not a member of any groups."),
		).toBeInTheDocument();
	});

	it("hides the combobox when the user is in every group", async () => {
		mockListGroups(allGroups);

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member, other]}
				primaryGroup={member}
			/>,
		);

		expect(
			await screen.findByText("This user is a member of every group."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: "Add group" }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "foo" })).toBeInTheDocument();
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

	it("adds a group using only the keyboard", async () => {
		mockListGroups(allGroups);
		mockUpdateUser(userId, 200, {});

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member]}
				primaryGroup={member}
			/>,
		);

		const combobox = await screen.findByRole("combobox", { name: "Add group" });

		await userEvent.tab();
		expect(combobox).toHaveFocus();

		await userEvent.keyboard("{ArrowDown}{Enter}");

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, groups: [1, 2] },
			}),
		);
	});

	it("keeps the remaining groups addable after a search-and-add", async () => {
		const third = createFakeGroup({ id: 3, name: "baz" });
		mockListGroups([member, other, third]);
		mockUpdateUser(userId, 200, {});

		const { rerender } = renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member]}
				primaryGroup={member}
			/>,
		);

		const combobox = await screen.findByRole("combobox", { name: "Add group" });

		await userEvent.type(combobox, "bar");
		await userEvent.click(await screen.findByRole("option", { name: "bar" }));

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, groups: [1, 2] },
			}),
		);

		// The updated user lands, making `bar` a member. A term left filtering to
		// `bar` would empty the options and hide the combobox entirely.
		rerender(
			<UserGroups
				userId={userId}
				memberGroups={[member, other]}
				primaryGroup={member}
			/>,
		);

		expect(combobox).toHaveValue("");
		expect(
			screen.queryByText("This user is a member of every group."),
		).not.toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "Toggle Add group menu" }),
		);

		expect(screen.getByRole("option", { name: "baz" })).toBeInTheDocument();
	});

	it("selects 'No primary group' by default when there is no primary group", async () => {
		mockListGroups(allGroups);

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member, other]}
				primaryGroup={null}
			/>,
		);

		expect(
			await screen.findByRole("radio", { name: "No primary group" }),
		).toBeChecked();
		expect(screen.getByRole("radio", { name: "foo" })).not.toBeChecked();
		expect(screen.getByRole("radio", { name: "bar" })).not.toBeChecked();
	});

	it("sets the primary group when a radio is selected", async () => {
		mockListGroups(allGroups);
		mockUpdateUser(userId, 200, {});

		renderWithProviders(
			<UserGroups
				userId={userId}
				memberGroups={[member, other]}
				primaryGroup={member}
			/>,
		);

		await userEvent.click(await screen.findByRole("radio", { name: "bar" }));

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, primaryGroup: 2 },
			}),
		);
	});

	it("clears the primary group when 'No primary group' is selected", async () => {
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
			await screen.findByRole("radio", { name: "No primary group" }),
		);

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, primaryGroup: null },
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

	it("removes a non-primary group without touching the primary", async () => {
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
			await screen.findByRole("button", { name: "Remove bar" }),
		);

		await waitFor(() =>
			expect(userServerFnMocks.updateUserFn).toHaveBeenCalledWith({
				data: { userId, groups: [1] },
			}),
		);
	});
});
