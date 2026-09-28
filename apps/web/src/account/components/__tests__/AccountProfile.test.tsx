import AccountProfile from "@account/components/AccountProfile";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockGetEmailDeliveryAvailable } from "@tests/server-fn/recovery";
import {
	mockGetAccount,
	mockUpdateAccountHandle,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<AccountProfile />", () => {
	beforeEach(() => {
		mockGetEmailDeliveryAvailable(true);
	});

	it("should hide the email form when delivery is not set up", async () => {
		mockGetEmailDeliveryAvailable(false);
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(/Ask an administrator/)).toBeInTheDocument();
		expect(screen.queryByLabelText("Email Address")).not.toBeInTheDocument();
	});

	it("should render when administrator", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
		});

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
		expect(screen.getByText("full Administrator")).toBeInTheDocument();
	});

	it("should render when not administrator", async () => {
		const account = createFakeAccount({ administratorRole: null });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		expect(await screen.findByText(account.handle)).toBeInTheDocument();
	});

	it("should render with the current handle", async () => {
		const account = createFakeAccount({ handle: "current_handle" });

		mockGetAccount(account);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		expect(screen.getByLabelText("Handle")).toHaveValue("current_handle");
	});

	it("should change the handle", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		const updateAccountHandle = mockUpdateAccountHandle(
			{ ...account, handle: "new_handle" },
			200,
			undefined,
			"new_handle",
		);
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Handle");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "new_handle");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() => expect(updateAccountHandle).toHaveBeenCalled());
	});

	it("should show a conflict error when the handle is taken", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		mockUpdateAccountHandle(undefined, 409, "User already exists.");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Handle");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "taken_handle");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(screen.getByText("User already exists.")).toBeInTheDocument(),
		);
	});

	it("should show an error when the handle is reserved", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		mockUpdateAccountHandle(undefined, 400, "Reserved user name: virtool");
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Handle");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.type(input, "virtool");
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		await waitFor(() =>
			expect(
				screen.getByText("Reserved user name: virtool"),
			).toBeInTheDocument(),
		);
	});

	it("should not submit an empty handle", async () => {
		const account = createFakeAccount({ handle: "old_handle" });

		mockGetAccount(account);
		mockUpdateAccountHandle({ ...account });
		renderWithProviders(<AccountProfile />);

		await screen.findByText("Handle");
		const input = screen.getByLabelText("Handle");
		const form = input.closest("form") as HTMLElement;

		await userEvent.clear(input);
		await userEvent.click(within(form).getByRole("button", { name: "Change" }));

		expect(
			await screen.findByText("Please specify a username"),
		).toBeInTheDocument();
		expect(userServerFnMocks.updateAccountHandleFn).not.toHaveBeenCalled();
	});
});
