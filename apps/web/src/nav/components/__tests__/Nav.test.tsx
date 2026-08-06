import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "@tests/setup";
import type { AdministratorRoleName } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import Nav from "../Nav";

describe("<Nav />", () => {
	const props: {
		administrator_role: AdministratorRoleName;
		handle: string;
	} = {
		administrator_role: "full",
		handle: "Bob",
	};

	it("should render", async () => {
		await renderWithRouter(<Nav {...props} />);
		expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("link", { name: "Jobs" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Samples" })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "References" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "HMMs" })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Subtractions" }),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "User menu" }));

		expect(
			screen.getByRole("menuitem", { name: "Signed in as Bob" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: "Account" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: "Administration" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("menuitem", { name: "Documentation" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: "Logout" }),
		).toBeInTheDocument();
	});

	it("opens the About dialog when the About button is clicked", async () => {
		await renderWithRouter(<Nav {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "About" }));

		expect(
			screen.getByRole("heading", { name: "About Virtool" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Documentation" }),
		).toBeInTheDocument();
		const docLink = screen.getByRole("link", { name: "virtool.ca/docs" });
		expect(docLink).toHaveAttribute(
			"href",
			"https://virtool.ca/docs/start/installation",
		);
	});
});
