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
	it.each([
		[true, "A key is configured"],
		[false, "No key configured"],
	])(
		"shows whether a key is configured when hasNcbiApiKey=%s",
		async (hasNcbiApiKey, placeholder) => {
			mockSettingsStore(createFakeSettings({ hasNcbiApiKey }));

			renderWithProviders(<NcbiApiKey />);

			expect(await screen.findByLabelText("API Key")).toHaveAttribute(
				"placeholder",
				placeholder,
			);
		},
	);

	it("saves a typed key and clears the field", async () => {
		const { setNcbiApiKey } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: false }),
		);

		renderWithProviders(<NcbiApiKey />);

		const input = await screen.findByLabelText("API Key");
		expect(
			screen.queryByRole("button", { name: "Remove" }),
		).not.toBeInTheDocument();
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

	it("offers to remove a usable key without a notice", async () => {
		const { clearNcbiApiKey } = mockSettingsStore(
			createFakeSettings({ hasNcbiApiKey: true, ncbiAvailability: "ready" }),
		);

		renderWithProviders(<NcbiApiKey />);

		const remove = await screen.findByRole("button", { name: "Remove" });
		expect(
			screen.queryByRole("status", { name: "ncbi api key status" }),
		).not.toBeInTheDocument();
		await userEvent.click(remove);

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
});
