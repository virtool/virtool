import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button, { ButtonGroup } from "../Button";

describe("<ButtonGroup />", () => {
	// The seams are drawn with `:first-child` / `:last-child`, so a member has to
	// be a DOM child of the group.
	it("should expose its members as its own children in a group", () => {
		render(
			<ButtonGroup>
				<Button>First</Button>
				<Button>Second</Button>
			</ButtonGroup>,
		);

		const group = screen.getByRole("group");

		expect(group.children).toHaveLength(2);
		expect(group.firstElementChild).toBe(
			screen.getByRole("button", { name: "First" }),
		);
		expect(group.lastElementChild).toBe(
			screen.getByRole("button", { name: "Second" }),
		);
	});
});
