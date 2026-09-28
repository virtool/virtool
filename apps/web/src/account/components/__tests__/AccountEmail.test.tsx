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
			/>,
		);

		expect(await screen.findByText("Email Address")).toBeInTheDocument();

		expect(screen.getByLabelText("Email Address")).toHaveValue(
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
			/>,
		);

		await screen.findByText("Email Address");
		const input = screen.getByLabelText("Email Address");
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
			/>,
		);

		expect(
			await screen.findByText("virtool.devs@gmail.com"),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Email Address")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Send verification" }),
		).not.toBeInTheDocument();
		expect(screen.getByText(/Ask an administrator/)).toBeInTheDocument();
	});

	it("should link administrators to email delivery when it is not set up", async () => {
		await renderWithRouter(
			<AccountEmail canManageEmail deliveryAvailable={false} email="" />,
		);

		expect(
			await screen.findByText("No email address on file."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Set up email delivery" }),
		).toHaveAttribute("href", "/administration/email");
	});
});
