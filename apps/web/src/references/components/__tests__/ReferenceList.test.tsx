import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakePermissions } from "@tests/fake/permissions";
import {
	createFakeReference,
	createFakeReferenceMinimal,
} from "@tests/fake/references";
import {
	mockCreateReference,
	mockFindReferences,
	referenceServerFnMocks,
} from "@tests/server-fn/references";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import ReferenceList from "../ReferenceList";

type ReferenceListSearch = {
	archived?: boolean;
	term?: string;
	page?: number;
};

function ReferenceListHarness() {
	const [search, setSearch] = useState<ReferenceListSearch>({
		archived: false,
		term: "",
	});

	function handleSetSearch(next: ReferenceListSearch) {
		setSearch((prev) => ({ ...prev, ...next }));
	}

	return <ReferenceList {...search} setSearch={handleSetSearch} />;
}

describe("<ReferenceList />", () => {
	let references: ReturnType<typeof createFakeReferenceMinimal>;

	beforeEach(() => {
		references = createFakeReferenceMinimal();
	});

	it("should render correctly", async () => {
		const permissions = createFakePermissions({ create_ref: true });
		const account = createFakeAccount({ permissions: permissions });
		mockGetAccount(account);
		mockFindReferences([references]);
		await renderWithRouter(<ReferenceList />);

		expect(await screen.findByText("References")).toBeInTheDocument();
		expect(screen.getByText(references.name)).toBeInTheDocument();
		expect(
			screen.getByText(`${references.user?.handle} created`),
		).toBeInTheDocument();

		expect(
			await screen.findByRole("button", { name: "clone" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("clone")).toBeInTheDocument();
	});

	describe("<ReferenceToolbar />", () => {
		it("should render when toolbar term is changed to foo", async () => {
			mockFindReferences([references]);
			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();

			const inputElement = screen.getByPlaceholderText("Reference name");
			expect(inputElement).toHaveValue("");

			await userEvent.type(inputElement, "Foo");
			expect(await screen.findByDisplayValue("Foo")).toBeInTheDocument();

			await userEvent.clear(screen.getByRole("textbox"));
		});

		it("should not render creation button when [canCreate=false]", async () => {
			const permissions = createFakePermissions({ create_ref: false });
			const account = createFakeAccount({ permissions: permissions });
			mockGetAccount(account);
			mockFindReferences([references]);
			await renderWithRouter(<ReferenceList />);

			expect(await screen.findByText("References")).toBeInTheDocument();
			expect(
				screen.queryByRole("link", { name: "Create" }),
			).not.toBeInTheDocument();
		});

		it("should default the lifecycle toggle to Active", async () => {
			mockFindReferences([references]);
			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();

			expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute(
				"data-state",
				"on",
			);
			expect(screen.getByRole("radio", { name: "Archived" })).toHaveAttribute(
				"data-state",
				"off",
			);
		});

		it("should refetch with archived=true when the Archived toggle is clicked", async () => {
			referenceServerFnMocks.findReferencesFn.mockImplementation(
				async ({ data }: { data: { archived?: boolean } }) =>
					data.archived
						? {
								foundCount: 0,
								totalCount: 0,
								page: 1,
								pageCount: 0,
								perPage: 25,
								items: [],
							}
						: {
								foundCount: 1,
								totalCount: 1,
								page: 1,
								pageCount: 1,
								perPage: 25,
								items: [references],
							},
			);

			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();

			await userEvent.click(screen.getByRole("radio", { name: "Archived" }));

			expect(
				await screen.findByText(/No archived references found/i),
			).toBeInTheDocument();
		});

		it("should handle toolbar updates correctly", async () => {
			mockFindReferences([references]);
			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();

			const inputElement = screen.getByPlaceholderText("Reference name");
			expect(inputElement).toHaveValue("");

			await userEvent.type(inputElement, "Foobar");
			expect(await screen.findByDisplayValue("Foobar")).toBeInTheDocument();
		});
	});

	describe("<CloneReference />", () => {
		it("handleSubmit() should mutate with correct input", async () => {
			const permissions = createFakePermissions({ create_ref: true });
			const account = createFakeAccount({ permissions: permissions });
			mockGetAccount(account);
			mockFindReferences([references]);
			const create = mockCreateReference(createFakeReference());
			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();
			await userEvent.click(
				await screen.findByRole("button", { name: "clone" }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Clone" }));

			expect(create).toHaveBeenCalledWith({
				data: {
					name: `Clone of ${references.name}`,
					description: `Cloned from ${references.name}`,
					cloneFrom: references.id,
				},
			});
		});

		it("handleSubmit() should mutate with changed input", async () => {
			const permissions = createFakePermissions({ create_ref: true });
			const account = createFakeAccount({ permissions: permissions });
			mockGetAccount(account);
			mockFindReferences([references]);
			const create = mockCreateReference(createFakeReference());
			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();
			await userEvent.click(
				await screen.findByRole("button", { name: "clone" }),
			);
			await userEvent.clear(screen.getByRole("textbox"));
			await userEvent.type(screen.getByRole("textbox"), "newName");
			await userEvent.click(screen.getByRole("button", { name: "Clone" }));

			expect(create).toHaveBeenCalledWith({
				data: {
					name: "newName",
					description: `Cloned from ${references.name}`,
					cloneFrom: references.id,
				},
			});
		});

		it("should display an error when name input is cleared", async () => {
			const permissions = createFakePermissions({ create_ref: true });
			const account = createFakeAccount({ permissions: permissions });
			mockGetAccount(account);
			mockFindReferences([references]);
			await renderWithRouter(<ReferenceListHarness />);

			expect(await screen.findByText("References")).toBeInTheDocument();
			await userEvent.click(
				await screen.findByRole("button", { name: "clone" }),
			);
			await userEvent.clear(screen.getByRole("textbox"));
			await userEvent.click(screen.getByRole("button", { name: "Clone" }));
			expect(screen.getByText("Required Field")).toBeInTheDocument();
		});
	});
});
