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
		onEdit: vi.fn(),
		onDelete: vi.fn(),
		onSelect: vi.fn(),
		segment: null,
		selected: false,
		sequence: "ATGC",
	};

	it("expands with the Enter key so its controls become reachable", async () => {
		renderWithProviders(<Sequence {...props} />);

		await userEvent.tab();
		await userEvent.tab();
		const row = screen.getByRole("button", { name: /^NC_010314/ });
		expect(row).toHaveFocus();
		expect(row).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Sequence controls")).not.toBeInTheDocument();
		expect(screen.queryByText("Test host")).not.toBeInTheDocument();

		await userEvent.keyboard("{Enter}");

		expect(row).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Sequence controls")).toBeInTheDocument();
		expect(screen.getByText("Test host")).toBeInTheDocument();
	});

	it("calls onSelect from its checkbox without expanding", async () => {
		const onSelect = vi.fn();

		renderWithProviders(<Sequence {...props} onSelect={onSelect} />);

		await userEvent.click(
			screen.getByRole("checkbox", { name: "Select NC_010314" }),
		);

		expect(onSelect).toHaveBeenCalledOnce();
		expect(screen.queryByText("Test host")).not.toBeInTheDocument();
	});
});
