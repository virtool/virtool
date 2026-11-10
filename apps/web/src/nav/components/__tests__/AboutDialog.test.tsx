import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AboutDialog from "../AboutDialog";

describe("<AboutDialog />", () => {
	it("shows the Virtool version", () => {
		renderWithProviders(<AboutDialog open setOpen={() => undefined} />);

		expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument();
	});

	it("links to the changelog page for the version", () => {
		renderWithProviders(<AboutDialog open setOpen={() => undefined} />);

		expect(screen.getByRole("link", { name: "Changelog" })).toHaveAttribute(
			"href",
			`https://www.virtool.ca/changelog/${__APP_VERSION__}`,
		);
	});
});
