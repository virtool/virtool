import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import { mockSettingsStore } from "@tests/server-fn/settings";
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

	it("refuses a maximum above the supported limit", async () => {
		const { updateSettings } = mockSettingsStore(
			createFakeSettings({ maxUploadSize: 5_000_000_000 }),
		);

		renderWithProviders(<MaxUploadSize />);

		const field = await screen.findByLabelText("Maximum (GB)");
		await userEvent.clear(field);
		await userEvent.type(field, "121");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(
			await screen.findByText("The maximum cannot exceed 120 GB."),
		).toBeVisible();
		expect(updateSettings).not.toHaveBeenCalled();
	});
});
