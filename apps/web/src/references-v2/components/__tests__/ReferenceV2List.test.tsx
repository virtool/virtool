import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import { mockGetReferencesV2 } from "@tests/server-fn/referencesV2";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderRoute, renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ReferenceV2List from "../ReferenceV2List";

describe("<ReferenceV2List />", () => {
	it("renders visible References with detail links", async () => {
		const active = createFakeReferenceV2({
			name: "Active Reference",
			description: "Active description",
		});
		const archived = createFakeReferenceV2({
			name: "Archived Reference",
			archived: true,
		});
		mockGetReferencesV2([active, archived]);

		await renderRoute("/refs/beta");

		expect(
			await screen.findByRole("link", { name: active.name }),
		).toHaveAttribute("href", `/refs/beta/${active.id}`);
		expect(screen.getByText("Active description")).toBeInTheDocument();
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("renders an empty state", async () => {
		mockGetReferencesV2([]);

		await renderRoute("/refs/beta");

		expect(
			await screen.findByText("No beta references found"),
		).toBeInTheDocument();
	});

	it("opens Reference creation in a dialog", async () => {
		mockGetReferencesV2([]);
		const account = createFakeAccount({
			permissions: createFakePermissions({ create_ref: true }),
		});
		mockGetAccount(account);
		await renderWithRouter(<ReferenceV2List />, "/refs/beta");

		await userEvent.click(
			await screen.findByRole("button", { name: "Create" }),
		);

		expect(
			screen.getByRole("dialog", { name: "Create Reference" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("Name", { exact: true })).toBeInTheDocument();
	});
});
