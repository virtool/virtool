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
	mockSetAdministratorRole,
	mockUpdateUser,
} from "@tests/server-fn/users";
import { renderWithProviders, renderWithRouter } from "@tests/setup";
import UserDetail from "@users/components/UserDetail";
import type { Group, User } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

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
	});

	describe("<UserDetail />", () => {
		it("should render correctly when administratorRole = AdministratorRoles.FULL, canModifyUser=true and 5 groups exist", async () => {
			mockListGroups(groups);

			const userDetail = createFakeUser({
				administratorRole: "full",
				groups,
			});

			const getUser = mockGetUser(userDetail.id, userDetail);

			renderWithProviders(<UserDetail userId={userDetail.id} />);

			expect(await screen.findByText("Change Password")).toBeInTheDocument();

			expect(screen.getByText(userDetail.handle)).toBeInTheDocument();
			expect(screen.getByLabelText("Administrator")).toBeInTheDocument();

			expect(
				screen.getByText("Force user to reset password on next login"),
			).toBeInTheDocument();
			expect(screen.getByText("Change Password")).toBeInTheDocument();

			expect(await screen.findByText("Groups")).toBeInTheDocument();
			expect(screen.getByLabelText("Group 0")).toBeInTheDocument();
			expect(screen.getByLabelText("Group 1")).toBeInTheDocument();
			expect(screen.getByLabelText("Group 2")).toBeInTheDocument();
			expect(screen.getByLabelText("Group 3")).toBeInTheDocument();

			expect(
				screen.getByRole("radiogroup", { name: "Primary group" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("radio", { name: "No primary group" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("radio", { name: "Group 1" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("radio", { name: "Group 4" }),
			).toBeInTheDocument();

			expect(screen.getByText("Permissions")).toBeInTheDocument();
			expect(
				screen.getByText("Change group membership to modify permissions"),
			).toBeInTheDocument();
			expect(screen.getByText("cancel_job")).toBeInTheDocument();
			expect(screen.getByText("create_sample")).toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});

		it("should render correctly when [administratorRole=null] and canModifyUser=false", async () => {
			mockListGroups(groups);
			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Change Password")).toBeInTheDocument();
			expect(screen.queryByLabelText("Administrator")).not.toBeInTheDocument();
			expect(screen.queryByText("User Role")).not.toBeInTheDocument();
			expect(screen.getByText("Group 4")).toBeInTheDocument();
			expect(screen.getByText("create_sample")).toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});

		it("should render correctly when user has insufficient permissions", async () => {
			mockGetAccount(createFakeAccount({ administratorRole: "users" }));
			const adminUser = createFakeUser({ administratorRole: "full" });
			const getUser = mockGetUser(adminUser.id, adminUser);

			renderWithProviders(<UserDetail userId={adminUser.id} />);

			expect(
				await screen.findByText(
					"You do not have permission to manage this user.",
				),
			).toBeInTheDocument();

			expect(screen.getByText("Contact an administrator.")).toBeInTheDocument();
			expect(screen.queryByText(adminUser.handle)).not.toBeInTheDocument();
			expect(screen.queryByText("Permissions")).not.toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});

		it("should handle user deactivation", async () => {
			mockListGroups(groups);
			mockGetUser(user.id, user);
			const updateUser = mockUpdateUser(user.id, 200, { active: false });
			renderWithProviders(<UserDetail userId={user.id} />);

			await userEvent.click(
				await screen.findByRole("button", { name: "Deactivate" }),
			);

			expect(updateUser).toHaveBeenCalled();
		});

		it("should handle user reactivation", async () => {
			mockListGroups(groups);
			const inactiveUser = createFakeUser({ active: false });
			mockGetUser(inactiveUser.id, inactiveUser);
			const updateUser = mockUpdateUser(inactiveUser.id, 200, {
				active: true,
			});
			renderWithProviders(<UserDetail userId={inactiveUser.id} />);

			await userEvent.click(
				await screen.findByRole("button", { name: "Activate" }),
			);

			expect(updateUser).toHaveBeenCalled();
		});
	});

	describe("<UserGroups />", () => {
		it("should render correctly", async () => {
			const listGroups = mockListGroups(groups);
			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			await waitFor(() => {
				expect(getUser).toHaveBeenCalled();
				expect(listGroups).toHaveBeenCalled();
			});

			expect(await screen.findByLabelText("Group 1")).toBeInTheDocument();
			expect(screen.getByLabelText("Group 3")).toBeInTheDocument();
		});
		it("should point to group creation when no groups exist", async () => {
			const user = createFakeUser({ groups: [], primaryGroup: null });

			mockListGroups([]);

			const getUser = mockGetUser(user.id, user);

			await renderWithRouter(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Groups")).toBeInTheDocument();
			expect(
				await screen.findByText(/No groups have been created yet/),
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: "Manage groups" }),
			).toBeInTheDocument();
			expect(screen.queryByLabelText("group3")).not.toBeInTheDocument();
			expect(
				screen.queryByRole("radiogroup", { name: "Primary group" }),
			).not.toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});
	});

	describe("<Handle />", () => {
		it("should render with the current handle", async () => {
			mockListGroups(groups);
			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Change Handle")).toBeInTheDocument();
			expect(screen.getByLabelText("handle")).toHaveValue(user.handle);

			expect(getUser).toHaveBeenCalled();
		});

		it("should submit a new handle", async () => {
			mockListGroups(groups);
			mockGetUser(user.id, user);
			const updateUser = mockUpdateUser(user.id, 200, { handle: "new_handle" });

			renderWithProviders(<UserDetail userId={user.id} />);

			const input = await screen.findByLabelText("handle");
			await userEvent.clear(input);
			await userEvent.type(input, "new_handle");

			const form = input.closest("form") as HTMLElement;
			await userEvent.click(within(form).getByRole("button", { name: "Save" }));

			await waitFor(() => expect(updateUser).toHaveBeenCalled());
		});

		it("should show a conflict error when the handle is taken", async () => {
			mockListGroups(groups);
			mockGetUser(user.id, user);
			mockUpdateUser(user.id, 409, { message: "User already exists." });

			renderWithProviders(<UserDetail userId={user.id} />);

			const input = await screen.findByLabelText("handle");
			await userEvent.clear(input);
			await userEvent.type(input, "taken_handle");

			const form = input.closest("form") as HTMLElement;
			await userEvent.click(within(form).getByRole("button", { name: "Save" }));

			await waitFor(() =>
				expect(screen.getByText("User already exists.")).toBeInTheDocument(),
			);
		});

		it("should show an error when the handle is reserved", async () => {
			mockListGroups(groups);
			mockGetUser(user.id, user);
			mockUpdateUser(user.id, 400, {
				message: "Reserved user name: virtool",
			});

			renderWithProviders(<UserDetail userId={user.id} />);

			const input = await screen.findByLabelText("handle");
			await userEvent.clear(input);
			await userEvent.type(input, "virtool");

			const form = input.closest("form") as HTMLElement;
			await userEvent.click(within(form).getByRole("button", { name: "Save" }));

			await waitFor(() =>
				expect(
					screen.getByText("Reserved user name: virtool"),
				).toBeInTheDocument(),
			);
		});
	});

	describe("<Password />", () => {
		it("should render correctly", async () => {
			mockListGroups(groups);
			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Change Password")).toBeInTheDocument();
			expect(screen.getByText(/Last changed/)).toBeInTheDocument();
			expect(
				screen.getByText("Force user to reset password on next login"),
			).toBeInTheDocument();
			expect(screen.getByLabelText("password")).toBeInTheDocument();
			const passwordForm = screen
				.getByLabelText("password")
				.closest("form") as HTMLElement;
			expect(
				within(passwordForm).getByRole("button", { name: "Save" }),
			).toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});

		it("should submit when password is long enough", async () => {
			mockListGroups(groups);
			mockUpdateUser(user.id, 200, { password: "newPassword" }, user);
			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Change Password")).toBeInTheDocument();

			const passwordInput = screen.getByLabelText("password");
			await userEvent.type(passwordInput, "newPassword");
			const passwordForm = passwordInput.closest("form") as HTMLElement;
			await userEvent.click(
				within(passwordForm).getByRole("button", { name: "Save" }),
			);

			expect(getUser).toHaveBeenCalled();
		});

		it("should display error when password is not long enough", async () => {
			mockListGroups(groups);
			mockUpdateUser(user.id, 400, {
				id: "bad_request",
				message: "Password does not meet minimum length requirement (8)",
			});
			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Change Password")).toBeInTheDocument();

			const passwordForm = screen
				.getByLabelText("password")
				.closest("form") as HTMLElement;
			await userEvent.click(
				within(passwordForm).getByRole("button", { name: "Save" }),
			);

			await waitFor(() =>
				expect(
					screen.getByText(
						"Password does not meet minimum length requirement (8)",
					),
				).toBeInTheDocument(),
			);

			expect(getUser).toHaveBeenCalled();
		});
	});

	describe("<UserPermissions />", () => {
		it("should render permissions correctly", async () => {
			mockListGroups(groups);

			const permissions = {
				cancel_job: true,
				create_ref: true,
				create_sample: true,
				modify_hmm: true,
				modify_subtraction: true,
				remove_file: false,
				remove_job: false,
				upload_file: false,
			};

			const user = createFakeUser({ permissions });

			const getUser = mockGetUser(user.id, user);

			renderWithProviders(<UserDetail userId={user.id} />);

			expect(await screen.findByText("Permissions")).toBeInTheDocument();
			expect(
				await screen.findByText(
					"Change group membership to modify permissions",
				),
			).toBeInTheDocument();
			expect(screen.getByLabelText("cancel_job:true")).toBeInTheDocument();
			expect(screen.getByLabelText("create_sample:true")).toBeInTheDocument();
			expect(screen.getByLabelText("remove_file:false")).toBeInTheDocument();
			expect(screen.getByLabelText("upload_file:false")).toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});
	});

	describe("<UserAdministratorRole />", () => {
		beforeEach(() => {
			mockListGroups(groups);
			mockGetAccount(createFakeAccount({ id: 1, administratorRole: "full" }));
			mockListAdministratorRoles(administratorRoles);
		});

		it("shows the role selector when managing another user", async () => {
			const target = createFakeUser({ id: 2, administratorRole: null });
			mockGetUser(target.id, target);

			renderWithProviders(<UserDetail userId={target.id} />);

			expect(await screen.findByText("Administrator Role")).toBeInTheDocument();
			expect(screen.getByText("Select administrator role")).toBeInTheDocument();
		});

		it("lets a full administrator remove a user's role", async () => {
			const target = createFakeUser({ id: 2, administratorRole: "users" });
			mockGetUser(target.id, target);
			const setAdministratorRole = mockSetAdministratorRole(target);

			renderWithProviders(<UserDetail userId={target.id} />);

			await userEvent.click(
				await screen.findByRole("button", {
					name: "remove administrator role",
				}),
			);

			await waitFor(() => expect(setAdministratorRole).toHaveBeenCalled());
		});

		it("is hidden for a full administrator viewing their own account", async () => {
			const self = createFakeUser({ id: 1, administratorRole: "full" });
			const getUser = mockGetUser(self.id, self);

			renderWithProviders(<UserDetail userId={self.id} />);

			expect(await screen.findByText("Change Password")).toBeInTheDocument();
			expect(screen.queryByText("Administrator Role")).not.toBeInTheDocument();

			expect(getUser).toHaveBeenCalled();
		});
	});
});
