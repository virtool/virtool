import { screen, within } from "@testing-library/react";
import { mockGetRoot } from "@tests/server-fn/root";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AboutDialog from "../AboutDialog";

describe("<AboutDialog />", () => {
	it("shows the server and web app versions", async () => {
		mockGetRoot({ firstUser: false, version: "5.4.3" });

		renderWithProviders(<AboutDialog open setOpen={() => undefined} />);

		const serverVersion = await screen.findByText("5.4.3");
		const server = screen.getByText("Server").closest("div");
		expect(server).toContainElement(serverVersion);

		const webApp = screen.getByText("Web app").closest("div");
		expect(
			within(webApp as HTMLElement).getByText(__APP_VERSION__),
		).toBeInTheDocument();
	});

	it("links to the changelog page for the web app version", async () => {
		mockGetRoot({ firstUser: false, version: "5.4.3" });

		renderWithProviders(<AboutDialog open setOpen={() => undefined} />);

		expect(
			await screen.findByRole("link", { name: "Changelog" }),
		).toHaveAttribute(
			"href",
			`https://www.virtool.ca/changelog/${__APP_VERSION__}`,
		);
	});
});
