import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockGetAccount, userServerFnMocks } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AccountSettings from "../AccountSettings";

describe("<AccountSettings />", () => {
	it("should show and save the acronym preference when toggled", async () => {
		const account = createFakeAccount();
		const settings = { ...account.settings, preferAcronym: false };
		mockGetAccount({ ...account, settings });
		const saved = { ...settings, preferAcronym: true };
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderWithProviders(<AccountSettings />);

		const toggle = await screen.findByRole("switch", {
			name: "Prefer acronym",
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

	it("should save the time format when one is chosen", async () => {
		const account = createFakeAccount();
		mockGetAccount(account);
		const saved = { ...account.settings, timeFormat: "absolute" as const };
		userServerFnMocks.updateAccountSettingsFn.mockResolvedValue(saved);

		renderWithProviders(<AccountSettings />);

		const group = await screen.findByRole("group", {
			name: "Time format",
		});
		expect(within(group).getByRole("radio", { checked: true })).toHaveValue(
			"relative",
		);

		mockGetAccount({ ...account, settings: saved });

		await userEvent.click(
			within(group).getByRole("radio", { name: /Date and time/ }),
		);

		await waitFor(() =>
			expect(userServerFnMocks.updateAccountSettingsFn).toHaveBeenCalledWith({
				data: { timeFormat: "absolute" },
			}),
		);
	});

	it("should list the copied columns in order and the hidden ones apart", async () => {
		const account = createFakeAccount();
		mockGetAccount({
			...account,
			settings: {
				...account.settings,
				pathoscopeColumns: ["weight", "name"],
			},
		});

		renderWithProviders(<AccountSettings />);

		const divider = await screen.findByRole("separator");
		const buttons = screen.getAllByRole("button", { name: /^Move / });

		expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
			"Move Weight / Reads",
			"Move Name",
			"Move Depth",
			"Move Coverage",
		]);
		expect(
			buttons.map((button) =>
				Boolean(
					divider.compareDocumentPosition(button) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				),
			),
		).toEqual([false, false, true, true]);
		expect(within(divider).getByText("Hidden columns")).toBeInTheDocument();
	});
});
