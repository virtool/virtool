import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import Sequence from "../Sequence";

// The expanded controls depend on OTU/reference/router context that is out of
// scope for this component's own interaction logic.
vi.mock("../SequenceButtons", () => ({
	default: () => <div>Sequence controls</div>,
}));

describe("<Sequence />", () => {
	const props = {
		accession: "NC_010314",
		definition: "Test definition",
		host: "Test host",
		id: "test_sequence",
		onEdit: vi.fn(),
		onDelete: vi.fn(),
		segment: null,
		sequence: "ATGC",
	};

	it("exposes the collapsed row as an accessible, collapsed button", () => {
		renderWithProviders(<Sequence {...props} />);

		const row = screen.getByRole("button", { name: /NC_010314/ });

		expect(row).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Sequence controls")).not.toBeInTheDocument();
		expect(screen.queryByText("Test host")).not.toBeInTheDocument();
	});

	it("expands with the Enter key so its controls become reachable", async () => {
		renderWithProviders(<Sequence {...props} />);

		await userEvent.tab();
		const row = screen.getByRole("button", { name: /NC_010314/ });
		expect(row).toHaveFocus();

		await userEvent.keyboard("{Enter}");

		expect(row).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Sequence controls")).toBeInTheDocument();
		expect(screen.getByText("Test host")).toBeInTheDocument();
	});

	it("expands with the Space key", async () => {
		renderWithProviders(<Sequence {...props} />);

		await userEvent.tab();
		await userEvent.keyboard("[Space]");

		expect(screen.getByText("Sequence controls")).toBeInTheDocument();
	});

	it("still expands on click", async () => {
		renderWithProviders(<Sequence {...props} />);

		await userEvent.click(screen.getByRole("button", { name: /NC_010314/ }));

		expect(screen.getByText("Test host")).toBeInTheDocument();
	});
});
