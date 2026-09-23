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

		await renderRoute("/refs/alpha");

		expect(
			await screen.findByRole("link", { name: active.name }),
		).toHaveAttribute("href", `/refs/alpha/${active.id}`);
		expect(screen.getByText("Active description")).toBeInTheDocument();
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("renders an empty state", async () => {
		mockGetReferencesV2([]);

		await renderRoute("/refs/alpha");

		expect(
			await screen.findByText("No alpha references found"),
		).toBeInTheDocument();
	});

	it("filters References by name", async () => {
		const matching = createFakeReferenceV2({ name: "Plant Viruses" });
		const hidden = createFakeReferenceV2({ name: "Fungal Viruses" });
		mockGetReferencesV2([matching, hidden]);

		await renderRoute("/refs/alpha");
		await userEvent.type(
			await screen.findByRole("textbox", { name: "Search references" }),
			"plant",
		);

		expect(
			screen.getByRole("link", { name: matching.name }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: hidden.name }),
		).not.toBeInTheDocument();
	});

	it("renders an empty search state when no References match", async () => {
		mockGetReferencesV2([createFakeReferenceV2({ name: "Plant Viruses" })]);

		await renderRoute("/refs/alpha");
		await userEvent.type(
			await screen.findByRole("textbox", { name: "Search references" }),
			"bacteria",
		);

		expect(
			screen.getByText("No references match your search."),
		).toBeInTheDocument();
	});

	it("opens Reference creation in a dialog", async () => {
		mockGetReferencesV2([]);
		const account = createFakeAccount({
			permissions: createFakePermissions({ create_ref: true }),
		});
		mockGetAccount(account);
		await renderWithRouter(<ReferenceV2List />, "/refs/alpha");

		await userEvent.click(
			await screen.findByRole("button", { name: "Create" }),
		);

		expect(
			screen.getByRole("dialog", { name: "Create Reference" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("Name", { exact: true })).toBeInTheDocument();
	});
});
