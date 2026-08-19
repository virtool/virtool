import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import { mockSettingsStore } from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

const { default: NcbiApiKey } = await import("../NcbiApiKey");

describe("<NcbiApiKey>", () => {
	it("saves a typed key and clears the field", async () => {
		const { updateSettings } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: false }),
		);

		renderWithProviders(<NcbiApiKey />);

		const input = await screen.findByLabelText("API Key");
		await userEvent.type(input, "  secret-key  ");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(updateSettings).toHaveBeenCalledWith({
				data: { ncbiApiKey: "secret-key" },
			});
		});

		await waitFor(() => expect(input).toHaveValue(""));
	});

	it("refuses to save an empty field", async () => {
		const { updateSettings } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: false }),
		);

		renderWithProviders(<NcbiApiKey />);

		await userEvent.click(await screen.findByRole("button", { name: "Save" }));

		expect(await screen.findByText("An API key is required.")).toBeVisible();
		expect(updateSettings).not.toHaveBeenCalled();
	});

	it("offers to remove a configured key", async () => {
		const { updateSettings } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: true }),
		);

		renderWithProviders(<NcbiApiKey />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove" }),
		);

		await waitFor(() => {
			expect(updateSettings).toHaveBeenCalledWith({ data: { ncbiApiKey: "" } });
		});
	});

	it("offers no removal when no key is configured", async () => {
		mockSettingsStore(createFakeSettings({ hasNcbiApiKey: false }));

		renderWithProviders(<NcbiApiKey />);

		expect(await screen.findByLabelText("API Key")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Remove" }),
		).not.toBeInTheDocument();
	});
});
