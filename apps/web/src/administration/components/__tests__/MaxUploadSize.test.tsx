import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import {
	mockSettingsStore,
	settingsServerFnMocks,
} from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

const { default: MaxUploadSize } = await import("../MaxUploadSize");

describe("<MaxUploadSize>", () => {
	// The setting is stored in bytes but entered in gigabytes, so the conversion
	// has to survive both directions.
	it("shows the stored maximum in gigabytes", async () => {
		mockSettingsStore(createFakeSettings({ maxUploadSize: 5_000_000_000 }));

		renderWithProviders(<MaxUploadSize />);

		expect(await screen.findByLabelText("Maximum (GB)")).toHaveValue(5);
	});

	it("saves the entered maximum in bytes", async () => {
		const { updateSettings } = mockSettingsStore(
			createFakeSettings({ maxUploadSize: 5_000_000_000 }),
		);

		renderWithProviders(<MaxUploadSize />);

		const field = await screen.findByLabelText("Maximum (GB)");
		await userEvent.clear(field);
		await userEvent.type(field, "20");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(updateSettings).toHaveBeenCalledWith({
				data: { maxUploadSize: 20_000_000_000 },
			}),
		);
	});

	// A larger maximum could never be honoured: the Azure block blob protocol
	// refuses the upload whatever the setting says.
	it("refuses a maximum above the protocol ceiling", async () => {
		const { updateSettings } = mockSettingsStore(
			createFakeSettings({ maxUploadSize: 5_000_000_000 }),
		);

		renderWithProviders(<MaxUploadSize />);

		const field = await screen.findByLabelText("Maximum (GB)");
		await userEvent.clear(field);
		await userEvent.type(field, "300000");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(
			await screen.findByText("The maximum cannot exceed 209715.2 GB."),
		).toBeVisible();
		expect(updateSettings).not.toHaveBeenCalled();
	});

	it("shows a loader while the settings are pending", () => {
		settingsServerFnMocks.getSettingsFn.mockReturnValue(
			new Promise(() => undefined),
		);

		renderWithProviders(<MaxUploadSize />);

		expect(screen.getByRole("status", { name: "loading" })).toBeInTheDocument();
	});

	it("shows an error when the settings cannot be read", async () => {
		settingsServerFnMocks.getSettingsFn.mockRejectedValue(
			new Error("Forbidden"),
		);

		renderWithProviders(<MaxUploadSize />);

		expect(await screen.findByText(/couldn't load settings/i)).toBeVisible();
	});
});
