import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount, createFakeApiKey } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import {
	mockCreateApiKey,
	mockFindApiKeys,
	mockUpdateApiKey,
} from "@tests/server-fn/account";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ApiKeys from "../ApiKeys";

describe("<ApiKeys />", () => {
	const basePath = "/account/api";

	it("should render and function when loaded", async () => {
		const user = userEvent.setup();

		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		mockFindApiKeys([]);

		mockCreateApiKey("testKey", createFakePermissions({ modify_hmm: true }));

		await renderWithRouter(<ApiKeys />, basePath);

		await screen.findByRole("heading", { name: "API Keys" });

		expect(screen.getByText("No API keys found")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Create" }));

		const dialog = screen.getByRole("dialog", { name: "Create API Key" });
		const input = within(dialog).getByLabelText("Name");

		expect(
			within(dialog).getByText(/The key can read all the data that you can/),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(/You are an administrator/),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(
				/If your administrator role is reduced or removed, this API/,
			),
		).toBeInTheDocument();

		// Check that submission without a name fails.
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(
			await screen.findByText("Provide a name for the key"),
		).toBeInTheDocument();

		await user.type(input, "Key A");
		expect(input).toHaveValue("Key A");

		const checkbox = screen.getByRole("checkbox", {
			name: "modify_hmm",
		});
		await user.click(checkbox);
		expect(checkbox).toBeChecked();

		// The list refetches when the create mutation invalidates the account
		// cache, so the new key must be resolvable before the save is submitted.
		mockFindApiKeys([
			createFakeApiKey({
				name: "Key A",
				permissions: createFakePermissions({ modify_hmm: true }),
			}),
		]);

		await user.click(screen.getByRole("button", { name: "Save" }));

		// Test that the secret key is displayed in the dialog after creation.
		expect(
			await screen.findByRole("heading", { name: "API Key Created" }),
		).toBeInTheDocument();
		expect(screen.getByText(/It won’t be shown again/)).toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: "API key" })).toHaveValue(
			"testKey",
		);

		await user.keyboard("{Escape}");

		// Test that the new key is displayed in the list.
		expect(screen.getByText("Key A")).toBeInTheDocument();
		expect(screen.getByText(/Created/)).toBeInTheDocument();
		expect(screen.getByText("1 permission")).toBeInTheDocument();
	});

	it("should save edited key permissions", async () => {
		const key = createFakeApiKey();
		const permissions = {
			...key.permissions,
			create_ref: false,
			upload_file: true,
		};
		const updateApiKey = mockUpdateApiKey({ ...key, permissions });

		mockGetAccount(
			createFakeAccount({
				permissions: createFakePermissions({
					create_ref: true,
					upload_file: true,
				}),
			}),
		);
		mockFindApiKeys([key]);

		await renderWithRouter(<ApiKeys />, basePath);

		await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

		const dialog = await screen.findByRole("dialog", {
			name: "Edit API Key",
		});

		const createRefCheckbox = await within(dialog).findByRole("checkbox", {
			name: "create_ref",
		});
		const uploadFileCheckbox = await within(dialog).findByRole("checkbox", {
			name: "upload_file",
		});

		expect(
			within(dialog).getByText(/Permissions limit what the key can change/),
		).toBeInTheDocument();
		expect(createRefCheckbox).toBeChecked();
		expect(uploadFileCheckbox).not.toBeChecked();

		await userEvent.click(createRefCheckbox);
		await userEvent.click(uploadFileCheckbox);

		expect(uploadFileCheckbox).toBeChecked();

		await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(updateApiKey).toHaveBeenCalledWith({
				data: { keyId: key.id, permissions },
			}),
		);
	});
});
