import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button, { ButtonGroup } from "../Button";

describe("<ButtonGroup />", () => {
	it("should expose its members as a group", () => {
		render(
			<ButtonGroup>
				<Button>First</Button>
				<Button>Second</Button>
			</ButtonGroup>,
		);

		const group = screen.getByRole("group");

		expect(group).toBeInTheDocument();
		expect(group).toContainElement(
			screen.getByRole("button", { name: "First" }),
		);
		expect(group).toContainElement(
			screen.getByRole("button", { name: "Second" }),
		);
	});

	// The seams are drawn with `:first-child` / `:last-child`, so a member has to
	// be a DOM child of the group.
	it("should render its members as its own children", () => {
		const { container } = render(
			<ButtonGroup>
				<Button>First</Button>
				<Button>Second</Button>
			</ButtonGroup>,
		);

		const group = container.firstElementChild;

		expect(group?.children).toHaveLength(2);
		expect(group?.firstElementChild).toHaveTextContent("First");
		expect(group?.lastElementChild).toHaveTextContent("Second");
	});
});
