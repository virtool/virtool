import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SkipLink from "../SkipLink";

describe("<SkipLink />", () => {
	it("moves focus to the main content only while it is activated", async () => {
		const user = userEvent.setup();

		render(
			<>
				<SkipLink />
				<main id="main-content">
					<button type="button">Content action</button>
				</main>
			</>,
		);

		const link = screen.getByRole("link", { name: "Skip to main content" });
		const main = screen.getByRole("main");

		expect(link).toHaveAttribute("href", "#main-content");
		expect(main).not.toHaveAttribute("tabindex");

		await user.click(link);

		expect(main).toHaveFocus();
		expect(main).toHaveAttribute("tabindex", "-1");

		await user.tab();

		expect(
			screen.getByRole("button", { name: "Content action" }),
		).toHaveFocus();
		expect(main).not.toHaveAttribute("tabindex");
	});
});
