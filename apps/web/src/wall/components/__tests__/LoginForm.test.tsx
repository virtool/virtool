import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";

const { loginMock } = vi.hoisted(() => ({
	loginMock: vi.fn(),
}));

vi.mock("../../queries", async () => {
	const { useMutation } = await import("@tanstack/react-query");
	return {
		useLoginMutation: () =>
			useMutation({
				mutationFn: loginMock,
			}),
	};
});

import LoginForm from "../LoginForm";

describe("<LoginForm />", () => {
	afterEach(() => {
		loginMock.mockReset();
	});

	it("calls the login mutation with the form values", async () => {
		const handle = "test_Username";
		const password = "Password";
		const setResetRequired = vi.fn();

		loginMock.mockResolvedValue({ reset: false });

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), handle);
		await userEvent.type(screen.getByLabelText("Password"), password);
		await userEvent.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
		expect(loginMock).toHaveBeenCalledWith(
			{
				handle,
				password,
			},
			expect.anything(),
		);
	});

	it("displays the thrown error message on login failure", async () => {
		const handle = "test_Username";
		const password = "Password";
		const errorMessage = "Invalid handle or password.";
		const setResetRequired = vi.fn();

		loginMock.mockRejectedValue(new Error(errorMessage));

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), handle);
		await userEvent.type(screen.getByLabelText("Password"), password);
		await userEvent.click(screen.getByRole("button", { name: "Login" }));

		expect(await screen.findByText(errorMessage)).toBeInTheDocument();
	});
});
