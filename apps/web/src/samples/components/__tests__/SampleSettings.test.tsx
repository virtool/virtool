import { screen, waitFor } from "@testing-library/react";
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

	it("should render", async () => {
		renderWithProviders(<SampleSettings />);

		await waitFor(() =>
			expect(screen.getByText("Sample Settings")).toBeInTheDocument(),
		);

		expect(screen.getByText("Sample Group")).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /None/ })).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: /Force choice/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: /User's primary group/ }),
		).toBeInTheDocument();
		expect(screen.getByText("Group Rights")).toBeInTheDocument();
		expect(screen.getByLabelText("Group Rights")).toBeInTheDocument();
		expect(screen.getByText("All Users' Rights")).toBeInTheDocument();
		expect(screen.getByLabelText("All Users' Rights")).toBeInTheDocument();
	});

	it("should describe each sample group policy", async () => {
		renderWithProviders(<SampleSettings />);

		await waitFor(() =>
			expect(screen.getByText("Sample Settings")).toBeInTheDocument(),
		);

		expect(
			screen.getByRole("radio", { name: /Force choice/ }),
		).toHaveTextContent(
			"Samples are assigned by the user in the creation form",
		);
		expect(
			screen.getByRole("radio", { name: /User's primary group/ }),
		).toHaveTextContent(
			"Samples are automatically assigned the creating user's primary group",
		);
	});

	it("should update settings when force choice is selected", async () => {
		const settings = createFakeSettings({ sampleGroup: "force_choice" });
		const updateSettings = mockUpdateSettings(settings);
		renderWithProviders(<SampleSettings />);

		await waitFor(() =>
			expect(screen.getByText("Sample Settings")).toBeInTheDocument(),
		);
		await userEvent.click(screen.getByRole("radio", { name: /Force choice/ }));

		expect(updateSettings).toHaveBeenCalledWith({
			data: { sampleGroup: "force_choice" },
		});
	});

	it("should update settings when users primary group is selected", async () => {
		const settings = createFakeSettings({
			sampleGroup: "users_primary_group",
		});
		const updateSettings = mockUpdateSettings(settings);
		renderWithProviders(<SampleSettings />);

		await waitFor(() =>
			expect(screen.getByText("Sample Settings")).toBeInTheDocument(),
		);
		await userEvent.click(
			screen.getByRole("radio", { name: /User's primary group/ }),
		);

		expect(updateSettings).toHaveBeenCalledWith({
			data: { sampleGroup: "users_primary_group" },
		});
	});

	it("should update settings when group rights change", async () => {
		const settings = createFakeSettings({
			sampleGroupRead: true,
			sampleGroupWrite: true,
		});
		const updateSettings = mockUpdateSettings(settings);
		renderWithProviders(<SampleSettings />);

		await waitFor(() =>
			expect(screen.getByText("Sample Settings")).toBeInTheDocument(),
		);
		await userEvent.click(screen.getByLabelText("Group Rights"));
		await userEvent.click(screen.getByRole("option", { name: "Read & write" }));

		expect(updateSettings).toHaveBeenCalledWith({
			data: { sampleGroupRead: true, sampleGroupWrite: true },
		});
	});

	it("should update settings when all users rights change", async () => {
		const settings = createFakeSettings({
			sampleAllRead: true,
			sampleAllWrite: true,
		});
		const updateSettings = mockUpdateSettings(settings);
		renderWithProviders(<SampleSettings />);

		await waitFor(() =>
			expect(screen.getByText("Sample Settings")).toBeInTheDocument(),
		);
		await userEvent.click(screen.getByLabelText("All Users' Rights"));
		await userEvent.click(screen.getByRole("option", { name: "Read & write" }));

		expect(updateSettings).toHaveBeenCalledWith({
			data: { sampleAllRead: true, sampleAllWrite: true },
		});
	});
});
