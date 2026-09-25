import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeUser } from "@tests/fake/user";
import { mockListGroups } from "@tests/server-fn/groups";
import {
	createFakeInvitation,
	mockDeletePendingUser,
	mockGetAccount,
	mockGetInvitation,
	mockGetUser,
	mockInvitationEmailAvailability,
	mockRegenerateInvitation,
} from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import UserDetail from "@users/components/UserDetail";
import type { Invitation, User } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

describe("<InvitationControls />", () => {
	let user: User;
	let invitation: Invitation;

	beforeEach(() => {
		user = createFakeUser({ handle: "", lifecycleState: "pending" });
		invitation = createFakeInvitation({
			userId: user.id,
			email: "bob@example.com",
			expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
		});
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockListGroups([]);
		mockGetUser(user.id, user);
		mockInvitationEmailAvailability(true);
	});

	it("shows the recipient in the heading and the invitation status", async () => {
		mockGetInvitation(invitation);

		await renderWithRouter(<UserDetail userId={user.id} />);

		expect(
			await screen.findByRole("heading", { name: /bob@example.com/ }),
		).toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
		expect(screen.getByText("in 3 days")).toBeInTheDocument();
		expect(screen.getByText("Shared link")).toBeInTheDocument();
	});

	it("marks an invitation past its expiry as expired", async () => {
		mockGetInvitation({
			...invitation,
			expiresAt: new Date(Date.now() - 60 * 60 * 1000),
		});

		await renderWithRouter(<UserDetail userId={user.id} />);

		expect(
			await screen.findByText(/The invitation link expired/),
		).toBeInTheDocument();
		expect(screen.getAllByText("Expired")).toHaveLength(2);
	});

	it("warns when the invitation email failed", async () => {
		mockGetInvitation({
			...invitation,
			delivery: "queued",
			outboxStatus: "failed",
		});

		await renderWithRouter(<UserDetail userId={user.id} />);

		expect(
			await screen.findByText(/The invitation email could not be sent/),
		).toBeInTheDocument();
	});

	it("reissues the invitation as a shareable link", async () => {
		mockGetInvitation(invitation);
		const regenerate = mockRegenerateInvitation(user, invitation.email);

		await renderWithRouter(<UserDetail userId={user.id} />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Reissue" }),
		);
		const dialog = screen.getByRole("dialog");
		await userEvent.click(
			within(dialog).getByRole("radio", { name: /Create shareable link/ }),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Reissue" }),
		);

		await waitFor(() =>
			expect(regenerate).toHaveBeenCalledWith({
				data: { userId: user.id, deliveryIntent: "copy_only" },
			}),
		);
		expect(
			within(dialog).getByRole("heading", { name: "Invitation Reissued" }),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(/The previous link no longer works/),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("textbox", { name: "Account setup link" }),
		).toHaveValue(
			`${window.location.origin}/account-setup#token=${"b".repeat(64)}`,
		);
	});

	it("reissues the invitation by email by default", async () => {
		mockGetInvitation(invitation);
		const regenerate = mockRegenerateInvitation(user, invitation.email);

		await renderWithRouter(<UserDetail userId={user.id} />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Reissue" }),
		);
		const dialog = screen.getByRole("dialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Reissue" }),
		);

		await waitFor(() =>
			expect(regenerate).toHaveBeenCalledWith({
				data: { userId: user.id, deliveryIntent: "email" },
			}),
		);
		expect(
			within(dialog).getByText(/An invitation email to bob@example.com/),
		).toBeInTheDocument();
		expect(
			within(dialog).queryByRole("textbox", { name: "Account setup link" }),
		).not.toBeInTheDocument();
	});

	it("deletes the invited user after confirmation", async () => {
		mockGetInvitation(invitation);
		const deletePendingUser = mockDeletePendingUser();

		const { router } = await renderWithRouter(
			<UserDetail userId={user.id} />,
			`/administration/users/${user.id}`,
		);

		expect(
			await screen.findByRole("heading", { name: "Danger Zone" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Deactivate" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Revoke" }),
		).not.toBeInTheDocument();

		await userEvent.click(
			await screen.findByRole("button", { name: "Delete" }),
		);
		expect(deletePendingUser).not.toHaveBeenCalled();

		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).getByText("bob@example.com")).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Confirm" }),
		);

		await waitFor(() =>
			expect(deletePendingUser).toHaveBeenCalledWith({
				data: { userId: user.id },
			}),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/administration/users"),
		);
	});
});
