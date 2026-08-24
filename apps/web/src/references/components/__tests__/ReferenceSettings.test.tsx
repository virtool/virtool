import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import { mockSettingsStore } from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { expect, test } from "vitest";
import ReferenceSettings from "../ReferenceSettings";

test("GlobalSourceTypes", async () => {
	const { updateSettings } = mockSettingsStore(
		createFakeSettings({ defaultSourceTypes: ["Clone", "Genotype"] }),
	);

	renderWithProviders(<ReferenceSettings />);

	// Wait for the settings to load (loading is absorbed by Suspense).
	expect(await screen.findByText("Clone")).toBeInTheDocument();
	expect(screen.getByText("Genotype")).toBeInTheDocument();

	// Delete 'Clone'.
	const cloneRow = (await screen.findByText("Clone")).closest(
		"div",
	) as HTMLElement;
	await userEvent.click(
		within(cloneRow).getByRole("button", { name: "Remove" }),
	);

	expect(updateSettings).toHaveBeenCalledWith({
		data: { defaultSourceTypes: ["Genotype"] },
	});

	await waitFor(() => {
		expect(
			screen.queryByText("The source type was just removed", {
				exact: false,
			}),
		).toBeInTheDocument();
		expect(screen.queryAllByText("Clone")).toHaveLength(1);
	});

	// Undo deletion.
	await userEvent.click(screen.getByRole("button", { name: "undo" }));

	expect(updateSettings).toHaveBeenCalledWith({
		data: { defaultSourceTypes: ["Genotype", "Clone"] },
	});

	await waitFor(() => {
		expect(
			screen.queryByText("The source type was just removed", {
				exact: false,
			}),
		).not.toBeInTheDocument();
		expect(screen.queryAllByText("Clone")).toHaveLength(1);
	});

	// Add new source type 'Strain'.
	await userEvent.type(screen.getByRole("textbox"), "Strain");

	expect(screen.getByRole("textbox")).toHaveValue("Strain");

	await userEvent.click(screen.getByRole("button", { name: "Add" }));

	expect(updateSettings).toHaveBeenCalledWith({
		data: { defaultSourceTypes: ["Genotype", "Clone", "strain"] },
	});

	await waitFor(() => {
		expect(screen.queryByText("strain")).toBeInTheDocument();
	});
});
