import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ErrorState from "../ErrorState";

describe("ErrorState", () => {
	it("should render the default message and a decorative icon", () => {
		const { container } = render(<ErrorState />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		expect(container.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("should render a custom message, icon, and action", () => {
		const { container } = render(
			<ErrorState
				icon={<svg data-testid="custom-icon" />}
				message="Couldn't load samples"
			>
				<button type="button">Try again</button>
			</ErrorState>,
		);

		expect(screen.getByText("Couldn't load samples")).toBeInTheDocument();
		expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
		expect(
			container.querySelector(".lucide-circle-alert"),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Try again" }),
		).toBeInTheDocument();
	});
});
