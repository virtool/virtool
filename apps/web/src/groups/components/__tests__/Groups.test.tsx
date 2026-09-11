import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeGroup } from "@tests/fake/groups";
import { createFakePermissions } from "@tests/fake/permissions";
import { mockGetGroup, mockListGroups } from "@tests/server-fn/groups";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Groups from "../Groups";

describe("Groups", () => {
	it("should render correctly when loading = true", async () => {
		await renderWithRouter(<Groups />);

		expect(screen.queryByText("No groups found")).not.toBeInTheDocument();
		expect(screen.queryByText("cancel_job")).not.toBeInTheDocument();
		expect(screen.queryByText("No Group Members")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Delete" }),
		).not.toBeInTheDocument();
	});

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

	it("should render correctly when one groups exists and group contains no members", async () => {
		const group = createFakeGroup();
		mockListGroups([group]);
		mockGetGroup(group);
		await renderWithRouter(<Groups />);

		expect(
			await screen.findByRole("button", { name: "Delete" }),
		).toBeInTheDocument();
		expect(screen.queryByText("No groups found")).not.toBeInTheDocument();
		expect(screen.getByText("cancel_job")).toBeInTheDocument();
		expect(screen.getByText("No Group Members")).toBeInTheDocument();
		expect(screen.getAllByText(group.name)).toHaveLength(1);
		expect(screen.getByRole("textbox", { name: "name" })).toHaveValue(
			group.name,
		);
	});

	it("should render create new group view correctly", async () => {
		mockListGroups([]);
		await renderWithRouter(<Groups />);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		await userEvent.click(await screen.findByText("Create"));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Name")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
	});

	it("should announce a validation error and tie it to the input on failed submit", async () => {
		mockListGroups([]);
		await renderWithRouter(<Groups />);

		await userEvent.click(await screen.findByText("Create"));
		const input = screen.getByRole("textbox", { name: "Name" });
		expect(input).not.toBeInvalid();

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Provide a name for the group");
		expect(input).toBeInvalid();
		expect(input).toHaveAccessibleDescription("Provide a name for the group");
	});

	it("should render correctly when active group has a group member", async () => {
		const group = createFakeGroup({
			users: [{ handle: "testUser1", id: 1 }],
		});
		mockListGroups([group]);
		mockGetGroup(group);
		await renderWithRouter(<Groups />);

		expect(await screen.findByText("Members")).toBeInTheDocument();
		expect(screen.getByText("testUser1")).toBeInTheDocument();
		expect(screen.queryByText("No Group Members")).not.toBeInTheDocument();
	});

	it("should render correctly when more than one group exists", async () => {
		const group1 = createFakeGroup({
			users: [{ handle: "bob", id: 1 }],
			permissions: createFakePermissions({
				create_sample: true,
				modify_hmm: true,
			}),
			name: "Group 1",
		});
		const group2 = createFakeGroup({
			users: [{ handle: "testUser2", id: 2 }],
			permissions: createFakePermissions({
				create_sample: true,
				modify_hmm: true,
				remove_job: true,
			}),
			name: "Group 2",
		});

		mockListGroups([group1, group2]);
		mockGetGroup(group1);

		await renderWithRouter(<Groups />);

		expect(await screen.findByText("Group 1")).toBeInTheDocument();
		expect(screen.getByText("Group 2")).toBeInTheDocument();
		expect(screen.getByText("bob")).toBeInTheDocument();
	});
});
