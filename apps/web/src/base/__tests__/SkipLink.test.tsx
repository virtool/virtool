import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SkipLink from "../SkipLink";

function renderWithMain() {
	render(
		<>
			<SkipLink />
			<main id="main-content">
				<button type="button">Content action</button>
			</main>
		</>,
	);

	return {
		link: screen.getByRole("link", { name: "Skip to main content" }),
		main: screen.getByRole("main"),
	};
}

describe("<SkipLink />", () => {
	it("links to the main content region", () => {
		render(<SkipLink />);

		const link = screen.getByRole("link", { name: "Skip to main content" });

		expect(link).toHaveAttribute("href", "#main-content");
	});

	it("leaves the main content unfocusable until activated", () => {
		const { main } = renderWithMain();

		expect(main).not.toHaveAttribute("tabindex");
	});

	it("moves focus to the main content when activated", async () => {
		const user = userEvent.setup();
		const { link, main } = renderWithMain();

		await user.click(link);

		expect(main).toHaveFocus();
		expect(main).toHaveAttribute("tabindex", "-1");
	});

	it("makes the main content unfocusable again when it loses focus", async () => {
		const user = userEvent.setup();
		const { link, main } = renderWithMain();

		await user.click(link);
		await user.tab();

		expect(
			screen.getByRole("button", { name: "Content action" }),
		).toHaveFocus();
		expect(main).not.toHaveAttribute("tabindex");
	});
});
