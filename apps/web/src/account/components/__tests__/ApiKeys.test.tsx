import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount, createFakeApiKey } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import { mockCreateApiKey, mockFindApiKeys } from "@tests/server-fn/account";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ApiKeys from "../ApiKeys";

describe("<ApiKeys />", () => {
	const basePath = "/account/api";

	it("should render correctly when keys === null", async () => {
		await renderWithRouter(<ApiKeys />, basePath);

		expect(screen.getByLabelText("loading")).toBeInTheDocument();
		expect(
			screen.queryByText("Manage API keys for accessing the"),
		).not.toBeInTheDocument();
	});

	it("should render and function when loaded", async () => {
		const user = userEvent.setup();

		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		mockFindApiKeys([]);

		mockCreateApiKey("testKey", createFakePermissions({ remove_job: true }));

		await renderWithRouter(<ApiKeys />, "/account/api");

		await screen.findByRole("heading", {
			name: /Manage API keys for accessing the/,
		});

		expect(screen.getByText("No API keys found")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Create" }));

		const dialog = screen.getByRole("dialog", { name: "Create API Key" });
		const input = within(dialog).getByLabelText("Name");

		// Check that submission without a name fails.
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(
			await screen.findByText("Provide a name for the key"),
		).toBeInTheDocument();

		await user.type(input, "Key A");
		expect(input).toHaveValue("Key A");

		const checkbox = screen.getByRole("checkbox", {
			name: "remove_job",
		});
		await user.click(checkbox);
		expect(checkbox).toBeChecked();

		// The list refetches when the create mutation invalidates the account
		// cache, so the new key must be resolvable before the save is submitted.
		mockFindApiKeys([
			createFakeApiKey({
				name: "Key A",
				permissions: createFakePermissions({ remove_job: true }),
			}),
		]);

		await user.click(screen.getByRole("button", { name: "Save" }));

		// Test that the secret key is displayed in the dialog after creation.
		expect(await screen.findByText("Here is your key.")).toBeInTheDocument();
		expect(screen.getByText(/Make note of it now/)).toBeInTheDocument();
		expect(screen.getByDisplayValue("testKey")).toBeInTheDocument();

		await user.keyboard("{Escape}");

		// Test that the new key is displayed in the list.
		expect(screen.getByText("Key A")).toBeInTheDocument();
		expect(screen.getByText(/Created/)).toBeInTheDocument();
		expect(screen.getByText("1 permission")).toBeInTheDocument();
	});

	it("should show administrator notice when appropriate", async () => {
		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		mockFindApiKeys([]);

		await renderWithRouter(<ApiKeys />, basePath);

		await userEvent.click(
			await screen.findByRole("button", { name: "Create" }),
		);

		expect(
			await screen.findByText(/You are an administrator/),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/If your administrator role is reduced or removed, this API/,
			),
		).toBeInTheDocument();
	});

	it("should be able to edit keys", async () => {
		const key = createFakeApiKey();

		mockGetAccount(
			createFakeAccount({
				permissions: createFakePermissions({
					cancel_job: true,
					create_ref: true,
					upload_file: true,
				}),
			}),
		);
		mockFindApiKeys([key]);

		await renderWithRouter(<ApiKeys />, "/account/api");

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

		expect(createRefCheckbox).toBeChecked();
		expect(uploadFileCheckbox).not.toBeChecked();

		await userEvent.click(createRefCheckbox);
		await userEvent.click(uploadFileCheckbox);

		expect(uploadFileCheckbox).toBeChecked();
	});
});
