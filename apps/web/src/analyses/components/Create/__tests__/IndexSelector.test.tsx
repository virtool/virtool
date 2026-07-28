import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeIndexMinimal } from "@tests/fake/indexes";
import { renderWithProviders } from "@tests/setup";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import IndexSelector from "../IndexSelector";

function Harness({
	indexes,
}: {
	indexes: ReturnType<typeof createFakeIndexMinimal>[];
}) {
	const [selected, setSelected] = useState("");

	return (
		<IndexSelector
			indexes={indexes}
			selected={selected}
			onChange={setSelected}
		/>
	);
}

describe("<IndexSelector>", () => {
	it("shows an actionable empty state when no indexes are available", () => {
		renderWithProviders(<Harness indexes={[]} />);

		expect(screen.getByText(/no references found/i)).toBeVisible();
		expect(
			screen.getByText(/build a reference index before running an analysis/i),
		).toBeVisible();
		expect(screen.queryByRole("combobox")).toBeNull();
	});

	it("renders a selectable reference when indexes are available", async () => {
		const index = createFakeIndexMinimal({
			reference: { id: 1, name: "Plant Viruses" },
			version: 3,
		});

		renderWithProviders(<Harness indexes={[index]} />);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toBeVisible();

		await userEvent.click(trigger);
		expect(screen.getByRole("option", { name: /Plant Viruses/ })).toBeVisible();
	});
});
