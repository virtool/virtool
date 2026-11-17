import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import SampleNotes from "../SampleNotes";

describe("<SampleNotes />", () => {
	it("should render notes as markdown", () => {
		renderWithProviders(
			<SampleNotes notes={"## Sequencing\n\nRan on Friday."} />,
		);

		expect(screen.getByRole("heading", { level: 2 })).toMatchTextContent(
			"Sequencing",
		);
		expect(screen.getByText("Ran on Friday.")).toBeInTheDocument();
	});

	it("should render an empty state when there are no notes", () => {
		renderWithProviders(<SampleNotes notes="" />);

		expect(screen.getByText("No notes found")).toBeInTheDocument();
		expect(
			screen.getByText("No notes have been added yet."),
		).toBeInTheDocument();
	});
});
