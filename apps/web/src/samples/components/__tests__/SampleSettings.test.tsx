import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import { mockGetSettings, mockUpdateSettings } from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";
import SampleSettings from "../SampleSettings";

describe("<SampleSettings />", () => {
	beforeEach(() => {
		// The rights start denied so that selecting "Read & write" is always a
		// change. Left to the fake's random booleans, they can start as read &
		// write, making the click a no-op and the expected update never fire.
		mockGetSettings(
			createFakeSettings({
				sampleAllRead: false,
				sampleAllWrite: false,
				sampleGroupRead: false,
				sampleGroupWrite: false,
			}),
		);
	});

	async function renderSettings() {
		renderWithProviders(<SampleSettings />);

		expect(await screen.findByText("Sample Settings")).toBeInTheDocument();
	}

	it("should describe each sample group policy and save the one picked", async () => {
		const updateSettings = mockUpdateSettings(
			createFakeSettings({ sampleGroup: "force_choice" }),
		);
		await renderSettings();

		expect(screen.getByText("Sample Group")).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /None/ })).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: /Force choice/ }),
		).toHaveAccessibleDescription(
			"Samples are assigned by the user in the creation form.",
		);
		expect(
			screen.getByRole("radio", { name: /User’s primary group/ }),
		).toHaveAccessibleDescription(
			"Samples are automatically assigned the creating user’s primary group.",
		);

		await userEvent.click(screen.getByRole("radio", { name: /Force choice/ }));

		expect(updateSettings).toHaveBeenLastCalledWith({
			data: { sampleGroup: "force_choice" },
		});

		await userEvent.click(
			screen.getByRole("radio", { name: /User’s primary group/ }),
		);

		expect(updateSettings).toHaveBeenLastCalledWith({
			data: { sampleGroup: "users_primary_group" },
		});
	});

	it("should save the group and all users' rights", async () => {
		const updateSettings = mockUpdateSettings(
			createFakeSettings({
				sampleAllRead: false,
				sampleAllWrite: false,
				sampleGroupRead: true,
				sampleGroupWrite: true,
			}),
		);
		await renderSettings();

		await userEvent.click(screen.getByLabelText("Group Rights"));
		await userEvent.click(screen.getByRole("option", { name: "Read & write" }));

		expect(updateSettings).toHaveBeenLastCalledWith({
			data: { sampleGroupRead: true, sampleGroupWrite: true },
		});

		await userEvent.click(screen.getByLabelText("All Users' Rights"));
		await userEvent.click(screen.getByRole("option", { name: "Read & write" }));

		expect(updateSettings).toHaveBeenLastCalledWith({
			data: { sampleAllRead: true, sampleAllWrite: true },
		});
	});
});
