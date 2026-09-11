import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import {
	mockGetCacheUsage,
	mockSettingsStore,
} from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

const { default: CacheStorageBudget } = await import("../CacheStorageBudget");

describe("<CacheStorageBudget>", () => {
	it("explains when no usage history has been recorded", async () => {
		mockSettingsStore(createFakeSettings());

		renderWithProviders(<CacheStorageBudget />);

		expect(
			await screen.findByText(
				"Usage history will appear after the next hourly cache task.",
			),
		).toBeVisible();
	});

	it("shows the latest cache usage and count", async () => {
		mockSettingsStore(createFakeSettings());
		mockGetCacheUsage([
			{
				cacheCount: 12,
				recordedAt: new Date("2026-09-11T12:00:00Z"),
				totalSize: 25_000_000_000,
			},
		]);

		renderWithProviders(<CacheStorageBudget />);

		expect(
			await screen.findByRole("heading", { name: "Usage over 30 days" }),
		).toBeVisible();
		expect(screen.getByText("25.0 GB · 12 caches")).toBeVisible();
	});

	it("shows usage before the storage budget", async () => {
		mockSettingsStore(createFakeSettings());

		renderWithProviders(<CacheStorageBudget />);

		const usageHeading = await screen.findByRole("heading", { name: "Usage" });
		const budgetHeading = screen.getByRole("heading", {
			name: "Storage Budget",
		});

		expect(
			usageHeading.compareDocumentPosition(budgetHeading) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("stores a changed budget in bytes", async () => {
		const { updateSettings } = mockSettingsStore(createFakeSettings());

		renderWithProviders(<CacheStorageBudget />);

		const field = await screen.findByLabelText("Budget (GB)");
		await userEvent.clear(field);
		await userEvent.type(field, "75");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(updateSettings).toHaveBeenCalledWith({
				data: { cacheStorageBudget: 75_000_000_000 },
			});
		});
	});
});
