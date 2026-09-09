import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import { mockSettingsStore } from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

const { default: NcbiApiKey } = await import("../NcbiApiKey");

describe("<NcbiApiKey>", () => {
	// The field is empty whichever way the setting is stored, so the placeholder
	// is the only thing telling an administrator whether one is already set.
	it("says a key is configured when one is", async () => {
		mockSettingsStore(createFakeSettings({ hasNcbiApiKey: true }));

		renderWithProviders(<NcbiApiKey />);

		expect(await screen.findByLabelText("API Key")).toHaveAttribute(
			"placeholder",
			"A key is configured",
		);
	});

	it("says no key is configured when none is", async () => {
		mockSettingsStore(createFakeSettings({ hasNcbiApiKey: false }));

		renderWithProviders(<NcbiApiKey />);

		expect(await screen.findByLabelText("API Key")).toHaveAttribute(
			"placeholder",
			"No key configured",
		);
	});

	it("saves a typed key and clears the field", async () => {
		const { setNcbiApiKey } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: false }),
		);

		renderWithProviders(<NcbiApiKey />);

		const input = await screen.findByLabelText("API Key");
		await userEvent.type(input, "  secret-key  ");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(setNcbiApiKey).toHaveBeenCalledWith({
				data: { apiKey: "secret-key" },
			});
		});

		await waitFor(() => expect(input).toHaveValue(""));
	});

	it("refuses to save an empty field", async () => {
		const { setNcbiApiKey } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: false }),
		);

		renderWithProviders(<NcbiApiKey />);

		await userEvent.click(await screen.findByRole("button", { name: "Save" }));

		expect(await screen.findByText("An API key is required.")).toBeVisible();
		expect(setNcbiApiKey).not.toHaveBeenCalled();
	});

	it("offers to remove a configured key", async () => {
		const { clearNcbiApiKey } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: true }),
		);

		renderWithProviders(<NcbiApiKey />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove" }),
		);

		await waitFor(() => expect(clearNcbiApiKey).toHaveBeenCalled());
	});

	// A key that will not decrypt is still a stored key, so the placeholder keeps
	// saying one is configured and the notice says why it cannot be used.
	it("explains a key that cannot be decrypted", async () => {
		mockSettingsStore(
			createFakeSettings({
				hasNcbiApiKey: true,
				ncbiAvailability: "configuration_error",
			}),
		);

		renderWithProviders(<NcbiApiKey />);

		expect(
			await screen.findByRole("status", { name: "ncbi api key status" }),
		).toHaveTextContent("Configuration Error");
	});

	it("shows no notice when the stored key is usable", async () => {
		mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: true, ncbiAvailability: "ready" }),
		);

		renderWithProviders(<NcbiApiKey />);

		expect(await screen.findByLabelText("API Key")).toBeInTheDocument();
		expect(
			screen.queryByRole("status", { name: "ncbi api key status" }),
		).not.toBeInTheDocument();
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
