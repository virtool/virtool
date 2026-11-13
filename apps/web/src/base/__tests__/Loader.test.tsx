import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup.js";
import { describe, expect, it } from "vitest";
import Loader, { colorToClass } from "../Loader";

describe("<Loader />", () => {
	it("keeps the transparent bottom border across every color", () => {
		for (const color of Object.keys(
			colorToClass,
		) as (keyof typeof colorToClass)[]) {
			const { unmount } = renderWithProviders(<Loader color={color} />);

			const loader = screen.getByRole("status", { name: "loading" });

			expect(loader).toHaveClass("border-b-transparent");
			for (const expectedClass of colorToClass[color].split(" ")) {
				expect(loader).toHaveClass(expectedClass);
			}

			unmount();
		}
	});
});
