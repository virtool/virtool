import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import LibraryTypeSelector from "../LibraryTypeSelector";

describe("<LibraryTypeSelector>", () => {
	it("should call onSelect when selection changes", async () => {
		const onSelect = vi.fn();
		renderWithProviders(
			<LibraryTypeSelector libraryType="normal" onSelect={onSelect} />,
		);

		await userEvent.click(screen.getByRole("combobox"));
		await userEvent.click(screen.getByRole("option", { name: /sRNA/i }));
		expect(onSelect).toHaveBeenCalledWith("srna");
	});

	it("should show Normal as selected when libraryType is 'normal'", () => {
		renderWithProviders(
			<LibraryTypeSelector libraryType="normal" onSelect={vi.fn()} />,
		);

		expect(screen.getByRole("combobox")).toHaveTextContent("Normal");
	});
});
