import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { administratorRoles } from "@tests/fake/administrator";
import { createFakeGroup } from "@tests/fake/groups";
import { createFakeUser } from "@tests/fake/user";
import { mockListGroups } from "@tests/server-fn/groups";
import {
	mockGetAccount,
	mockGetUser,
	mockListAdministratorRoles,
	mockResetUserTotp,
	mockRevokeUserAccess,
	mockSetAdministratorRole,
	mockUpdateUser,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import UserDetail from "@users/components/UserDetail";
import type { Group, User } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

function renderUserDetail(target: User, twoFactorEnabled = false) {
	mockGetUser(target.id, target, twoFactorEnabled);
	return renderWithProviders(<UserDetail userId={target.id} />);
}

async function submitHandle(handle: string) {
	const input = await screen.findByLabelText("handle");
	await userEvent.clear(input);
	await userEvent.type(input, handle);

	const form = input.closest("form") as HTMLElement;
	await userEvent.click(within(form).getByRole("button", { name: "Save" }));
}

describe("<UserDetail />", () => {
	let groups: Group[];
	let user: User;

	beforeEach(() => {
		groups = Array.from({ length: 5 }, (_, index) =>
			createFakeGroup({ name: `Group ${index}` }),
		);
		user = createFakeUser({
			groups: groups.map(({ id, name, legacyId }) => ({
				id,
				name,
				legacyId,
			})),
			active: true,
		});
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockListGroups(groups);
	});

	describe("<UserDetail />", () => {
		it("should render correctly when administratorRole = AdministratorRoles.FULL and canModifyUser=true", async () => {
			const userDetail = createFakeUser({
				administratorRole: "full",
				groups,
			});

			renderUserDetail(userDetail);

			expect(await screen.findByText(userDetail.handle)).toBeInTheDocument();
			expect(screen.getByLabelText("Administrator")).toBeInTheDocument();
		});

		it("should render correctly when [administratorRole=null] and canModifyUser=false", async () => {
			renderUserDetail(user);

			expect(await screen.findByText("Group 4")).toBeInTheDocument();
			expect(screen.queryByLabelText("Administrator")).not.toBeInTheDocument();
			expect(screen.queryByText("User Role")).not.toBeInTheDocument();
			expect(screen.getByText("create_sample")).toBeInTheDocument();
		});

		it("should render correctly when user has insufficient permissions", async () => {
			mockGetAccount(createFakeAccount({ administratorRole: "users" }));
			const adminUser = createFakeUser({ administratorRole: "full" });

			renderUserDetail(adminUser);

			expect(
				await screen.findByText(
					"You do not have permission to manage this user.",
				),
			).toBeInTheDocument();

			expect(screen.getByText("Contact an administrator.")).toBeInTheDocument();
			expect(screen.queryByText(adminUser.handle)).not.toBeInTheDocument();
			expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
		});

		it("should handle user deactivation", async () => {
			const updateUser = mockUpdateUser(user.id, 200, { active: false });
			renderUserDetail(user);

			await userEvent.click(
				await screen.findByRole("button", { name: "Deactivate" }),
			);

			expect(updateUser).toHaveBeenCalled();
		});

		it("should handle user reactivation", async () => {
			const inactiveUser = createFakeUser({ active: false });
			const updateUser = mockUpdateUser(inactiveUser.id, 200, {
				active: true,
			});
			renderUserDetail(inactiveUser);

			await userEvent.click(
				await screen.findByRole("button", { name: "Activate" }),
			);

			expect(updateUser).toHaveBeenCalled();
		});
	});

	describe("<RevokeUserAccess />", () => {
		it("lets an administrator revoke a user's access", async () => {
			const revokeUserAccess = mockRevokeUserAccess(user);

			renderUserDetail(user);

			await userEvent.click(
				await screen.findByRole("button", { name: "Revoke" }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

			await waitFor(() =>
				expect(revokeUserAccess).toHaveBeenCalledWith({
					data: { userId: user.id },
				}),
			);
		});
	});

	describe("<ResetUserTotp />", () => {
		it("lets a full administrator reset an enrolled user", async () => {
			const enrolled = createFakeUser();
			const resetUserTotp = mockResetUserTotp(enrolled);

			renderUserDetail(enrolled, true);

			await userEvent.click(
				await screen.findByRole("button", { name: "Reset" }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

			await waitFor(() =>
				expect(resetUserTotp).toHaveBeenCalledWith({
					data: { userId: enrolled.id },
				}),
			);
		});
	});

	describe("<Handle />", () => {
		it("should show the current handle and submit a new one", async () => {
			const updateUser = mockUpdateUser(user.id, 200, { handle: "new_handle" });

			renderUserDetail(user);

			expect(await screen.findByText("Change Handle")).toBeInTheDocument();
			expect(screen.getByLabelText("handle")).toHaveValue(user.handle);

			await submitHandle("new_handle");

			await waitFor(() =>
				expect(updateUser).toHaveBeenCalledWith({
					data: { userId: user.id, handle: "new_handle" },
				}),
			);
		});

		it("should show the server's error when the handle is taken or reserved", async () => {
			userServerFnMocks.updateUserFn
				.mockRejectedValueOnce(new Error("User already exists."))
				.mockRejectedValueOnce(new Error("Reserved username: virtool"));

			renderUserDetail(user);

			await submitHandle("taken_handle");
			expect(
				await screen.findByText("User already exists."),
			).toBeInTheDocument();

			await submitHandle("virtool");
			expect(
				await screen.findByText("Reserved username: virtool"),
			).toBeInTheDocument();
		});
	});

	describe("<UserPermissions />", () => {
		it("should render permissions correctly", async () => {
			const permissions = {
				create_ref: true,
				create_sample: true,
				modify_hmm: true,
				modify_subtraction: true,
				remove_file: false,
				upload_file: false,
			};

			renderUserDetail(createFakeUser({ permissions }));

			expect(await screen.findByText("Permissions")).toBeInTheDocument();
			expect(
				await screen.findByText(
					"Change group membership to modify permissions",
				),
			).toBeInTheDocument();
			expect(screen.getByLabelText("create_ref:true")).toBeInTheDocument();
			expect(screen.getByLabelText("create_sample:true")).toBeInTheDocument();
			expect(screen.getByLabelText("remove_file:false")).toBeInTheDocument();
			expect(screen.getByLabelText("upload_file:false")).toBeInTheDocument();
		});
	});

	describe("<UserAdministratorRole />", () => {
		beforeEach(() => {
			mockGetAccount(createFakeAccount({ id: 1, administratorRole: "full" }));
			mockListAdministratorRoles(administratorRoles);
		});

		it("shows the role selector when managing another user", async () => {
			renderUserDetail(createFakeUser({ id: 2, administratorRole: null }));

			expect(await screen.findByText("Administrator Role")).toBeInTheDocument();
			expect(screen.getByText("Select administrator role")).toBeInTheDocument();
		});

		it("lets a full administrator remove a user's role", async () => {
			const target = createFakeUser({ id: 2, administratorRole: "users" });
			const setAdministratorRole = mockSetAdministratorRole(target);

			renderUserDetail(target);

			await userEvent.click(
				await screen.findByRole("button", {
					name: "Remove administrator role",
				}),
			);

			await waitFor(() => expect(setAdministratorRole).toHaveBeenCalled());
		});

		it("is hidden for a full administrator viewing their own account", async () => {
			const self = createFakeUser({ id: 1, administratorRole: "full" });

			renderUserDetail(self);

			expect(await screen.findByText(self.handle)).toBeInTheDocument();
			expect(screen.queryByText("Administrator Role")).not.toBeInTheDocument();
		});
	});
});
