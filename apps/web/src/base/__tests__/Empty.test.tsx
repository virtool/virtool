import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "../Empty";

describe("Empty", () => {
	it("should hide the media from assistive technology", () => {
		render(
			<Empty>
				<EmptyMedia>
					<svg data-testid="icon" />
				</EmptyMedia>
				<EmptyTitle>No results</EmptyTitle>
				<EmptyDescription>Create one to get started</EmptyDescription>
				<EmptyContent>
					<button type="button">Try again</button>
				</EmptyContent>
			</Empty>,
		);

		expect(screen.getByTestId("icon").parentElement).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(screen.getByText("No results")).toBeInTheDocument();
		expect(screen.getByText("Create one to get started")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Try again" }),
		).toBeInTheDocument();
	});
});
