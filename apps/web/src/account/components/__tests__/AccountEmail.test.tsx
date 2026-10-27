import AccountEmail from "@account/components/AccountEmail";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockRequestAccountEmailChange } from "@tests/server-fn/recovery";
import { renderWithProviders, renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<AccountEmail />", () => {
	it("should render with initial email", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
			email: "virtool.devs@gmail.com",
		});

		renderWithProviders(
			<AccountEmail
				canManageEmail={false}
				deliveryAvailable
				email={account.email}
				emailVerified
				pendingEmail={null}
			/>,
		);

		expect(await screen.findByText("New Email Address")).toBeInTheDocument();

		expect(screen.getByLabelText("New Email Address")).toHaveValue(
			"virtool.devs@gmail.com",
		);
	});

	it("should handle email changes", async () => {
		const account = createFakeAccount({
			administratorRole: "full",
			email: "",
		});

		const requestAccountEmailChange = mockRequestAccountEmailChange();
		renderWithProviders(
			<AccountEmail
				canManageEmail={false}
				deliveryAvailable
				email={account.email}
				emailVerified
				pendingEmail={null}
			/>,
		);

		await screen.findByText("New Email Address");
		const input = screen.getByLabelText("New Email Address");
		expect(input).toHaveValue("");

		const form = input.closest("form") as HTMLElement;
		const button = within(form).getByRole("button", {
			name: "Send verification",
		});

		await userEvent.type(input, "invalid");
		await userEvent.click(button);

		expect(input).toHaveValue("invalid");
		expect(
			screen.getByText("Please provide a valid email address"),
		).toBeInTheDocument();
		expect(requestAccountEmailChange).not.toHaveBeenCalled();

		await userEvent.clear(input);
		await userEvent.type(input, "virtool.devs@gmail.com");
		await userEvent.click(button);

		await waitFor(() => expect(requestAccountEmailChange).toHaveBeenCalled());
		expect(requestAccountEmailChange).toHaveBeenCalledWith({
			data: { email: "virtool.devs@gmail.com" },
		});
	});

	it("should show the current address without a form when delivery is not set up", async () => {
		renderWithProviders(
			<AccountEmail
				canManageEmail={false}
				deliveryAvailable={false}
				email="virtool.devs@gmail.com"
				emailVerified
				pendingEmail={null}
			/>,
		);

		expect(
			await screen.findByText("virtool.devs@gmail.com"),
		).toBeInTheDocument();
		expect(
			screen.queryByLabelText("New Email Address"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Send verification" }),
		).not.toBeInTheDocument();
		expect(screen.getByText(/Ask an administrator/)).toBeInTheDocument();
	});

	it("should link administrators to email delivery when it is not set up", async () => {
		await renderWithRouter(
			<AccountEmail
				canManageEmail
				deliveryAvailable={false}
				email=""
				emailVerified={false}
				pendingEmail={null}
			/>,
		);

		expect(
			await screen.findByText("No email address on file."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Set up email delivery" }),
		).toHaveAttribute("href", "/administration/email");
	});

	it("should say whether the current address is verified", async () => {
		renderWithProviders(
			<AccountEmail
				canManageEmail={false}
				deliveryAvailable
				email="virtool.devs@gmail.com"
				emailVerified={false}
				pendingEmail={null}
			/>,
		);

		expect(await screen.findByText("Not verified")).toBeInTheDocument();
		expect(screen.queryByText(/We sent a verification link/)).toBeNull();
	});

	it("should show the address that waits for verification", async () => {
		renderWithProviders(
			<AccountEmail
				canManageEmail={false}
				deliveryAvailable
				email="virtool.devs@gmail.com"
				emailVerified
				pendingEmail="new@example.com"
			/>,
		);

		expect(await screen.findByText("Verified")).toBeInTheDocument();
		expect(screen.getByText("new@example.com")).toBeInTheDocument();
		expect(
			screen.getByText(
				/Your current address stays active until you open the link/,
			),
		).toBeInTheDocument();
	});
});
