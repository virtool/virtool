import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeGroup } from "@tests/fake/groups";
import { createFakePermissions } from "@tests/fake/permissions";
import {
	groupServerFnMocks,
	mockGetGroup,
	mockListGroups,
} from "@tests/server-fn/groups";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Groups from "../Groups";

describe("Groups", () => {
	it("should render correctly when no groups exist", async () => {
		mockListGroups([]);
		await renderWithRouter(<Groups />);

		expect(
			await screen.findByRole("heading", { name: "Groups" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Manage group memberships and permissions."),
		).toBeInTheDocument();
		expect(await screen.findByText("No groups found")).toBeInTheDocument();
		expect(
			screen.getByText("No groups have been created yet."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Delete" }),
		).not.toBeInTheDocument();
		expect(screen.getByText("Create")).toBeInTheDocument();
	});

	it("should show the selected group's name, permissions, and members", async () => {
		const group1 = createFakeGroup({
			users: [{ handle: "bob", id: 1 }],
			permissions: createFakePermissions({
				create_sample: true,
				modify_hmm: true,
			}),
			name: "Group 1",
		});
		const group2 = createFakeGroup({ users: [], name: "Group 2" });
		mockListGroups([group1, group2]);
		groupServerFnMocks.getGroupFn.mockImplementation(
			async ({ data }: { data: { groupId: number } }) =>
				[group1, group2].find((group) => group.id === data.groupId),
		);
		await renderWithRouter(<Groups />);

		expect(
			await screen.findByRole("button", { name: "Delete" }),
		).toBeInTheDocument();
		expect(screen.queryByText("No groups found")).not.toBeInTheDocument();
		expect(screen.getAllByText("Group 1")).toHaveLength(1);
		expect(screen.getByText("Group 2")).toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: "name" })).toHaveValue(
			"Group 1",
		);
		expect(screen.getByText("create_ref")).toBeInTheDocument();
		expect(screen.getByText("Members")).toBeInTheDocument();
		expect(screen.getByText("bob")).toBeInTheDocument();
		expect(screen.queryByText("No Group Members")).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole("tab", { name: "Group 2" }));

		expect(await screen.findByText("No Group Members")).toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: "name" })).toHaveValue(
			"Group 2",
		);
		expect(screen.queryByText("bob")).not.toBeInTheDocument();
	});

	it("should announce a validation error and tie it to the input on failed submit", async () => {
		mockListGroups([]);
		await renderWithRouter(<Groups />);

		await userEvent.click(await screen.findByText("Create"));
		const input = screen.getByRole("textbox", { name: "Name" });
		expect(input).not.toBeInvalid();

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		const alert = await screen.findByRole("alert");
		expect(alert).toMatchTextContent("Provide a name for the group");
		expect(input).toBeInvalid();
		expect(input).toHaveAccessibleDescription("Provide a name for the group");
	});

	it("creates a group and closes the dialog", async () => {
		mockListGroups([]);
		groupServerFnMocks.createGroupFn.mockResolvedValue(
			createFakeGroup({ name: "Technicians" }),
		);
		await renderWithRouter(<Groups />);

		await userEvent.click(await screen.findByText("Create"));
		await userEvent.type(
			screen.getByRole("textbox", { name: "Name" }),
			"Technicians",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(groupServerFnMocks.createGroupFn).toHaveBeenCalledWith({
			data: { name: "Technicians" },
		});
	});

	it("toggles a permission and renames the selected group", async () => {
		const group = createFakeGroup({
			name: "Technicians",
			permissions: createFakePermissions({ create_sample: true }),
		});
		mockListGroups([group]);
		mockGetGroup(group);
		groupServerFnMocks.updateGroupFn.mockResolvedValue(group);
		await renderWithRouter(<Groups />);

		await userEvent.click(
			await screen.findByRole("checkbox", { name: "create_sample" }),
		);
		await userEvent.click(screen.getByRole("checkbox", { name: "modify_hmm" }));

		await waitFor(() =>
			expect(groupServerFnMocks.updateGroupFn).toHaveBeenCalledTimes(2),
		);
		expect(groupServerFnMocks.updateGroupFn).toHaveBeenNthCalledWith(1, {
			data: {
				groupId: group.id,
				name: undefined,
				permissions: { create_sample: false },
			},
		});
		expect(groupServerFnMocks.updateGroupFn).toHaveBeenNthCalledWith(2, {
			data: {
				groupId: group.id,
				name: undefined,
				permissions: { modify_hmm: true },
			},
		});

		const name = screen.getByRole("textbox", { name: "name" });
		await userEvent.clear(name);
		await userEvent.type(name, "Curators{Enter}");

		await waitFor(() =>
			expect(groupServerFnMocks.updateGroupFn).toHaveBeenLastCalledWith({
				data: { groupId: group.id, name: "Curators", permissions: undefined },
			}),
		);
	});

	it("asks for confirmation before deleting a group", async () => {
		const group = createFakeGroup({ name: "Technicians" });
		mockListGroups([group]);
		mockGetGroup(group);
		groupServerFnMocks.deleteGroupFn.mockResolvedValue(null);
		await renderWithRouter(<Groups />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Delete" }),
		);

		expect(groupServerFnMocks.deleteGroupFn).not.toHaveBeenCalled();
		expect(
			screen.getByText(/its samples will have no group/i),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() =>
			expect(groupServerFnMocks.deleteGroupFn).toHaveBeenCalledWith({
				data: { groupId: group.id },
			}),
		);
	});
});
