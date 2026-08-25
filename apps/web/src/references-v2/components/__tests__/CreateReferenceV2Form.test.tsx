import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockCreateReferenceV2,
	mockGetReferencesV2,
	referenceV2ServerFnMocks,
} from "@tests/server-fn/referencesV2";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ReferenceV2List from "../ReferenceV2List";

describe("<CreateReferenceV2Form />", () => {
	it("creates a local Reference and refreshes the list", async () => {
		const reference = createFakeReferenceV2({ name: "Plant Viruses" });

		const createReference = mockCreateReferenceV2(reference);
		mockGetReferencesV2([]);

		const account = createFakeAccount({
			permissions: createFakePermissions({ create_ref: true }),
		});
		mockGetAccount(account);
		await renderWithRouter(<ReferenceV2List />, "/refs/beta");
		await userEvent.click(
			await screen.findByRole("button", { name: "Create" }),
		);
		const dialog = await screen.findByRole("dialog");

		await userEvent.type(
			within(dialog).getByLabelText("Name", { exact: true }),
			"Plant Viruses",
		);
		mockGetReferencesV2([reference]);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create" }),
		);

		expect(
			await screen.findByRole("link", { name: "Plant Viruses" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(createReference).toHaveBeenCalledTimes(1);
		expect(
			referenceV2ServerFnMocks.createReferenceV2Fn.mock.calls[0]?.[0],
		).toMatchObject({ data: { name: "Plant Viruses" } });
	});
});
