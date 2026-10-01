import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeGroup } from "@tests/fake/groups";
import { createFakeUser } from "@tests/fake/user";
import {
	mockCreateUser,
	mockInvitationEmailAvailability,
} from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import CreateUser from "../CreateUser";
import { CreateUserForm } from "../CreateUserForm";

describe("<CreateUser />", () => {
	it("links to email settings for full administrators when email is unavailable", async () => {
		await renderWithRouter(
			<CreateUserForm
				onSubmit={() => {}}
				error=""
				groups={[]}
				roles={[]}
				canAssignAdministratorRole
				canConfigureEmailDelivery
				emailDeliveryAvailable={false}
			/>,
		);

		expect(
			screen.getByRole("radio", { name: /Email invitation/ }),
		).toBeDisabled();
		expect(
			screen.getByText("Email invitations aren’t configured."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Configure email delivery" }),
		).toHaveAttribute("href", "/administration/email");
	});

	it("does not link to email settings for other administrators", async () => {
		await renderWithRouter(
			<CreateUserForm
				onSubmit={() => {}}
				error=""
				groups={[]}
				roles={[]}
				canAssignAdministratorRole={false}
				canConfigureEmailDelivery={false}
				emailDeliveryAvailable={false}
			/>,
		);

		expect(
			screen.getByRole("radio", { name: /Email invitation/ }),
		).toBeDisabled();
		expect(
			screen.queryByRole("link", { name: "Configure email delivery" }),
		).not.toBeInTheDocument();
	});

	it("creates user once form is submitted", async () => {
		const user = userEvent.setup();
		const emailInput = "user@example.com";
		const createUser = mockCreateUser(createFakeUser({ handle: "" }));
		await renderWithRouter(<CreateUser />);

		await userEvent.click(screen.getByRole("button"));

		const emailField = screen.getByLabelText("Email");
		await userEvent.type(emailField, emailInput);
		expect(emailField).toHaveValue(emailInput);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(createUser).toHaveBeenCalled());
		expect(createUser.mock.calls[0]?.[0]).toMatchObject({
			data: { email: emailInput },
		});
		expect(createUser.mock.calls[0]?.[0].data).not.toHaveProperty("handle");
		expect(screen.getByRole("heading", { name: "User Created" })).toBeVisible();
		expect(
			screen.getByText(/Send this link to user@example.com/),
		).toBeVisible();
		const link = screen.getByRole("textbox", { name: "Account setup link" });
		expect((link as HTMLInputElement).value).toContain("/account-setup#token=");
		const clipboard = vi.spyOn(navigator.clipboard, "writeText");
		clipboard.mockRejectedValueOnce(new Error("Clipboard unavailable"));
		await user.click(screen.getByRole("button", { name: "Copy" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Could not copy. Select the text and copy it manually.",
		);
		await user.click(screen.getByRole("button", { name: "Copy" }));
		expect(clipboard).toHaveBeenLastCalledWith(
			(link as HTMLInputElement).value,
		);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Copied to clipboard.",
		);
		await user.click(screen.getByRole("button", { name: "Done" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	it("defaults to email once availability loads", async () => {
		mockInvitationEmailAvailability(true);
		const createUser = mockCreateUser(createFakeUser({ handle: "" }));
		await renderWithRouter(<CreateUser />);

		await userEvent.click(screen.getByRole("button"));
		await waitFor(() =>
			expect(
				screen.getByRole("radio", { name: /Email invitation/ }),
			).toBeChecked(),
		);

		await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(createUser).toHaveBeenCalled());
		expect(createUser.mock.calls[0]?.[0].data).toMatchObject({
			deliveryIntent: "email",
		});
	});

	it("requires an email address", async () => {
		await renderWithRouter(<CreateUser />);
		await userEvent.click(screen.getByRole("button"));

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(
			screen.getByText("Please specify an email address"),
		).toBeInTheDocument();
	});

	it("places the email field before the groups", async () => {
		await renderWithRouter(
			<CreateUserForm
				onSubmit={() => {}}
				error=""
				groups={[createFakeGroup({ id: 1, name: "foo" })]}
				roles={[]}
				canAssignAdministratorRole={false}
				canConfigureEmailDelivery={false}
				emailDeliveryAvailable={false}
			/>,
		);

		const email = screen.getByLabelText("Email");
		const addGroup = screen.getByRole("combobox", { name: "Add group" });

		expect(
			email.compareDocumentPosition(addGroup) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("submits the added groups and primary group", async () => {
		const onSubmit = vi.fn();
		await renderWithRouter(
			<CreateUserForm
				onSubmit={onSubmit}
				error=""
				groups={[
					createFakeGroup({ id: 1, name: "foo" }),
					createFakeGroup({ id: 2, name: "bar" }),
					createFakeGroup({ id: 3, name: "baz" }),
				]}
				roles={[]}
				canAssignAdministratorRole={false}
				canConfigureEmailDelivery={false}
				emailDeliveryAvailable={false}
			/>,
		);

		expect(
			screen.getByText("This user is not a member of any groups."),
		).toBeInTheDocument();

		const combobox = screen.getByRole("combobox", { name: "Add group" });
		await userEvent.type(combobox, "baz");
		await userEvent.click(await screen.findByRole("option", { name: "baz" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Toggle Add group menu" }),
		);
		await userEvent.click(await screen.findByRole("option", { name: "foo" }));

		const primary = screen.getByRole("button", { name: "Primary group: foo" });
		await userEvent.click(primary);
		expect(primary).toHaveAttribute("aria-pressed", "true");

		await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
			groups: [3, 1],
			primaryGroup: 1,
		});
	});

	it("clears the primary group when it is removed", async () => {
		const onSubmit = vi.fn();
		await renderWithRouter(
			<CreateUserForm
				onSubmit={onSubmit}
				error=""
				groups={[
					createFakeGroup({ id: 1, name: "foo" }),
					createFakeGroup({ id: 2, name: "bar" }),
				]}
				roles={[]}
				canAssignAdministratorRole={false}
				canConfigureEmailDelivery={false}
				emailDeliveryAvailable={false}
			/>,
		);

		const toggle = screen.getByRole("button", {
			name: "Toggle Add group menu",
		});
		await userEvent.click(toggle);
		await userEvent.click(await screen.findByRole("option", { name: "foo" }));
		await userEvent.click(toggle);
		await userEvent.click(await screen.findByRole("option", { name: "bar" }));

		expect(
			screen.getByText("This user is a member of every group."),
		).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "Primary group: foo" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Remove foo" }));

		expect(
			screen.getByRole("button", { name: "Primary group: bar" }),
		).toHaveAttribute("aria-pressed", "false");

		await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
			groups: [2],
			primaryGroup: null,
		});
	});

	it("submits the chosen administrator role", async () => {
		const onSubmit = vi.fn();
		await renderWithRouter(
			<CreateUserForm
				onSubmit={onSubmit}
				error=""
				groups={[]}
				roles={[{ id: "users", name: "Users" }]}
				canAssignAdministratorRole
				canConfigureEmailDelivery
				emailDeliveryAvailable={false}
			/>,
		);

		await userEvent.click(
			screen.getByRole("combobox", { name: "Administrator role" }),
		);
		await userEvent.click(await screen.findByRole("option", { name: "Users" }));

		await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
			administratorRole: "users",
		});
	});
});
