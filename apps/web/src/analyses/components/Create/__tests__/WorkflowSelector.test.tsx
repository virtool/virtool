import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import WorkflowSelector from "../WorkflowSelector";
import { nuvsWorkflow, pathoscopeWorkflow } from "../workflows";

const pathoscopeName = pathoscopeWorkflow.name;
const nuvsName = nuvsWorkflow.name;

function Harness() {
	const [selected, setSelected] = useState(pathoscopeWorkflow.id);

	return (
		<WorkflowSelector
			workflows={[pathoscopeWorkflow, nuvsWorkflow]}
			selected={selected}
			onChange={setSelected}
		/>
	);
}

describe("<WorkflowSelector>", () => {
	it("renders each workflow as an accessible radio option", () => {
		renderWithProviders(<Harness />);

		expect(screen.getByRole("group", { name: "Workflow" })).toBeVisible();
		expect(screen.getByRole("radio", { name: pathoscopeName })).toBeChecked();
		expect(screen.getByRole("radio", { name: nuvsName })).not.toBeChecked();
	});

	it("describes what each workflow finds", () => {
		renderWithProviders(<Harness />);

		expect(
			screen.getByRole("radio", { name: pathoscopeName }),
		).toHaveAccessibleDescription("Find known viruses.");
		expect(
			screen.getByRole("radio", { name: nuvsName }),
		).toHaveAccessibleDescription("Find novel viruses.");
	});

	it("selects a workflow when its option is chosen", async () => {
		renderWithProviders(<Harness />);

		await userEvent.click(screen.getByRole("radio", { name: nuvsName }));

		expect(screen.getByRole("radio", { name: nuvsName })).toBeChecked();
		expect(
			screen.getByRole("radio", { name: pathoscopeName }),
		).not.toBeChecked();
	});

	it("selects a workflow when its name is clicked", async () => {
		renderWithProviders(<Harness />);

		await userEvent.click(screen.getByText(nuvsWorkflow.name));

		expect(screen.getByRole("radio", { name: nuvsName })).toBeChecked();
	});
});
