import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { mockGetAccount, userServerFnMocks } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AccountSettings from "../AccountSettings";
import { moveColumn } from "../PathoscopeColumns";

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
				name: "Prefer acronym",
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

describe("moveColumn()", () => {
	const order = ["name", "weight", "coverage", "divider", "depth"] as const;

	it("should reorder within the copied columns", () => {
		expect(moveColumn([...order], "coverage", "name")).toEqual([
			"coverage",
			"name",
			"weight",
			"divider",
			"depth",
		]);
	});

	it("should hide a column moved below the divider", () => {
		expect(moveColumn([...order], "weight", "depth")).toEqual([
			"name",
			"coverage",
			"divider",
			"depth",
			"weight",
		]);
	});

	it("should show a column moved above the divider", () => {
		expect(moveColumn([...order], "depth", "weight")).toEqual([
			"name",
			"depth",
			"weight",
			"coverage",
			"divider",
		]);
	});

	it("should hide the name like any other column", () => {
		expect(moveColumn([...order], "name", "depth")).toEqual([
			"weight",
			"coverage",
			"divider",
			"depth",
			"name",
		]);
	});

	it("should never hide the last shown column", () => {
		const current = [
			"weight",
			"divider",
			"name",
			"coverage",
			"depth",
		] as Parameters<typeof moveColumn>[0];

		expect(moveColumn(current, "weight", "name")).toBe(current);
	});
});
