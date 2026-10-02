import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSettings } from "@tests/fake/administrator";
import { createClientError } from "@tests/server-fn/auth";
import {
	mockSettingsStore,
	settingsServerFnMocks,
} from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

const { default: MfaPolicy } = await import("../MfaPolicy");

describe("<MfaPolicy>", () => {
	it("requires two-factor authentication", async () => {
		const { setMfaPolicy } = mockSettingsStore(
			createFakeSettings({ mfaPolicy: "optional" }),
		);

		renderWithProviders(<MfaPolicy />);

		const checkbox = await screen.findByRole("checkbox", {
			name: /Require two-factor authentication/,
		});
		expect(checkbox).not.toBeChecked();
		await userEvent.click(checkbox);

		await waitFor(() =>
			expect(setMfaPolicy).toHaveBeenCalledWith({
				data: { mfaPolicy: "required" },
			}),
		);
		await waitFor(() => expect(checkbox).toBeChecked());
	});

	it("makes two-factor authentication optional again", async () => {
		const { setMfaPolicy } = mockSettingsStore(
			createFakeSettings({ mfaPolicy: "required" }),
		);

		renderWithProviders(<MfaPolicy />);

		await userEvent.click(
			await screen.findByRole("checkbox", {
				name: /Require two-factor authentication/,
			}),
		);

		await waitFor(() =>
			expect(setMfaPolicy).toHaveBeenCalledWith({
				data: { mfaPolicy: "optional" },
			}),
		);
	});

	it("explains why the server refused the policy", async () => {
		mockSettingsStore(createFakeSettings({ mfaPolicy: "optional" }));
		settingsServerFnMocks.setMfaPolicyFn.mockRejectedValue(
			createClientError(
				"Set up two-factor authentication before requiring it.",
				409,
			),
		);

		renderWithProviders(<MfaPolicy />);

		await userEvent.click(
			await screen.findByRole("checkbox", {
				name: /Require two-factor authentication/,
			}),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Set up two-factor authentication before requiring it.",
		);
	});
});
