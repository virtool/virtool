import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeUser } from "@tests/fake/user";
import { mockCreateUser } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import CreateUser from "../CreateUser";

describe("<CreateUser />", () => {
	it("creates user once form is submitted", async () => {
		const usernameInput = "Username";
		const emailInput = "user@example.com";
		const createUser = mockCreateUser(
			createFakeUser({ handle: usernameInput }),
		);
		await renderWithRouter(<CreateUser />);

		await userEvent.click(screen.getByRole("button"));

		const usernameField = screen.getByLabelText("Username");
		await userEvent.type(usernameField, usernameInput);
		expect(usernameField).toHaveValue(usernameInput);

		const emailField = screen.getByLabelText("Email");
		await userEvent.type(emailField, emailInput);
		expect(emailField).toHaveValue(emailInput);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(createUser).toHaveBeenCalled());
		expect(screen.getByLabelText("Account setup link")).toBeInTheDocument();
	});

	it("should render correct username error message", async () => {
		await renderWithRouter(<CreateUser />);
		await userEvent.click(screen.getByRole("button"));

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByText("Please specify a username")).toBeInTheDocument();
		expect(
			screen.getByText("Please specify an email address"),
		).toBeInTheDocument();
	});
});
