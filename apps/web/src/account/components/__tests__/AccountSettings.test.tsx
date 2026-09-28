import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockGetAccount, userServerFnMocks } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AccountSettings from "../AccountSettings";

describe("<AccountSettings />", () => {
	it("should show the current abbreviation preference", async () => {
		const account = createFakeAccount();
		mockGetAccount({
			...account,
			settings: { ...account.settings, preferAbbreviation: true },
		});

		renderWithProviders(<AccountSettings />);

		expect(
			await screen.findByRole("switch", {
				name: "Prefer abbreviations in Pathoscope exports",
			}),
		).toBeChecked();
	});

	it("should save the abbreviation preference when toggled", async () => {
		const account = createFakeAccount();
		const settings = { ...account.settings, preferAbbreviation: false };
		mockGetAccount({ ...account, settings });
		const saved = { ...settings, preferAbbreviation: true };
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderWithProviders(<AccountSettings />);

		const toggle = await screen.findByRole("switch", {
			name: "Prefer abbreviations in Pathoscope exports",
		});
		expect(toggle).not.toBeChecked();

		mockGetAccount({ ...account, settings: saved });

		await userEvent.click(toggle);

		await waitFor(() =>
			expect(userServerFnMocks.updateAccountSettingsFn).toHaveBeenCalledWith({
				data: { preferAbbreviation: true },
			}),
		);
		expect(toggle).toBeChecked();
	});

	it("should save the Pathoscope column order when one is chosen", async () => {
		const account = createFakeAccount();
		mockGetAccount(account);
		const saved = {
			...account.settings,
			pathoscopeColumnOrder: "name-last" as const,
		};
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderWithProviders(<AccountSettings />);

		expect(
			await screen.findByRole("radio", {
				name: "Name, Weight, Depth, Coverage",
			}),
		).toBeChecked();

		mockGetAccount({ ...account, settings: saved });

		const nameLast = screen.getByRole("radio", {
			name: "Weight, Depth, Coverage, Name",
		});
		await userEvent.click(nameLast);

		await waitFor(() =>
			expect(userServerFnMocks.updateAccountSettingsFn).toHaveBeenCalledWith({
				data: { pathoscopeColumnOrder: "name-last" },
			}),
		);
		expect(nameLast).toBeChecked();
	});
});
