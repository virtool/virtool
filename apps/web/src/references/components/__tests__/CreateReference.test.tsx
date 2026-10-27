import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { CreateReference } from "../CreateReference";

describe("<CreateReference />", () => {
	it("should not render dialog content when closed", async () => {
		await renderWithRouter(
			<CreateReference open={false} onOpenChange={() => {}} />,
		);

		expect(screen.queryByText("Create Reference")).not.toBeInTheDocument();
	});

	it("should default to the Empty mode when opened", async () => {
		await renderWithRouter(
			<CreateReference open={true} onOpenChange={() => {}} />,
		);

		expect(screen.getByText("Create Reference")).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /Empty/i })).toBeChecked();
		expect(
			screen.getByRole("textbox", { name: "Organism" }),
		).toBeInTheDocument();
	});

	it("should preserve name and description when switching between modes", async () => {
		await renderWithRouter(
			<CreateReference open={true} onOpenChange={() => {}} />,
		);

		await userEvent.type(
			screen.getByRole("textbox", { name: "Name" }),
			"Test Reference",
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Description" }),
			"A description",
		);

		await userEvent.click(screen.getByRole("radio", { name: /Import/i }));

		expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
			"Test Reference",
		);
		expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
			"A description",
		);
		expect(
			screen.queryByRole("textbox", { name: "Organism" }),
		).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole("radio", { name: /Empty/i }));

		expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
			"Test Reference",
		);
		expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
			"A description",
		);
	});
});
