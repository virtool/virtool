import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Circle from "../Circle";

describe("Circle", () => {
	it("draws a full circle by default and passes props to the svg", () => {
		const { container } = render(<Circle aria-label="test-circle" />);

		expect(container.querySelector("svg")).toHaveAttribute(
			"aria-label",
			"test-circle",
		);
		expect(container.querySelector("circle")).toHaveAttribute(
			"fill",
			"currentColor",
		);
		expect(container.querySelector("path")).not.toBeInTheDocument();
	});

	it("draws half and empty fills as an outline", () => {
		const { container, rerender } = render(<Circle fill="half" />);

		expect(container.querySelector("path")).toHaveAttribute(
			"d",
			"M 5 0.5 A 4.5 4.5 0 0 0 5 9.5 Z",
		);
		expect(container.querySelector("circle")).toHaveAttribute("fill", "none");

		rerender(<Circle fill="empty" />);

		expect(container.querySelector("path")).not.toBeInTheDocument();
		expect(container.querySelector("circle")).toHaveAttribute("fill", "none");
		expect(container.querySelector("circle")).toHaveAttribute(
			"stroke",
			"currentColor",
		);
	});
});
