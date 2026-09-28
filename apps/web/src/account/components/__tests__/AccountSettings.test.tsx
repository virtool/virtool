import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockGetAccount, userServerFnMocks } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AccountSettings from "../AccountSettings";

describe("<AccountSettings />", () => {
	it("should show the current acronym preference", async () => {
		const account = createFakeAccount();
		mockGetAccount({
			...account,
			settings: { ...account.settings, preferAcronym: true },
		});

		renderWithProviders(<AccountSettings />);

		expect(
			await screen.findByRole("switch", {
				name: "Prefer acronyms in Pathoscope exports",
			}),
		).toBeChecked();
	});

	it("should save the acronym preference when toggled", async () => {
		const account = createFakeAccount();
		const settings = { ...account.settings, preferAcronym: false };
		mockGetAccount({ ...account, settings });
		const saved = { ...settings, preferAcronym: true };
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderWithProviders(<AccountSettings />);

		const toggle = await screen.findByRole("switch", {
			name: "Prefer acronyms in Pathoscope exports",
		});
		expect(toggle).not.toBeChecked();

		mockGetAccount({ ...account, settings: saved });

		await userEvent.click(toggle);

		await waitFor(() =>
			expect(userServerFnMocks.updateAccountSettingsFn).toHaveBeenCalledWith({
				data: { preferAcronym: true },
			}),
		);
		expect(toggle).toBeChecked();
	});
});
