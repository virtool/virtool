import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSubtraction } from "@tests/fake/subtractions";
import { mockDeleteSubtraction } from "@tests/server-fn/subtractions";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import DeleteSubtraction from "../DeleteSubtraction";

describe("<DeleteSubtraction />", () => {
	const subtraction = createFakeSubtraction();
	let props: ComponentProps<typeof DeleteSubtraction>;

	beforeEach(() => {
		props = { subtraction };
	});

	it("should render trigger and keep dialog closed initially", async () => {
		await renderWithRouter(<DeleteSubtraction {...props} />);

		expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
		expect(screen.queryByText("Delete Subtraction")).toBeNull();
	});

	it("should open dialog when trigger is clicked", async () => {
		await renderWithRouter(<DeleteSubtraction {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "Delete" }));

		expect(screen.getByText("Delete Subtraction")).toBeInTheDocument();
	});

	it("should delete subtraction when confirm button is clicked", async () => {
		const deleteSubtraction = mockDeleteSubtraction();
		await renderWithRouter(<DeleteSubtraction {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "Delete" }));
		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		expect(deleteSubtraction).toHaveBeenCalledWith({
			data: { subtractionId: subtraction.id },
		});
	});
});
