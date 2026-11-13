import { getDateFilter } from "@samples/dateFilter";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeGroupMinimal } from "@tests/fake/groups";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeIndexMinimal } from "@tests/fake/indexes";
import { createFakeLabel } from "@tests/fake/labels";
import { createFakeSampleMinimal } from "@tests/fake/samples";
import { createFakeSubtractionNested } from "@tests/fake/subtractions";
import { createFakeUserNested } from "@tests/fake/user";
import { mockFindHmms } from "@tests/server-fn/hmm";
import { mockListReadyIndexes } from "@tests/server-fn/indexes";
import { mockFindLabels } from "@tests/server-fn/labels";
import {
	mockFindSamplePages,
	mockFindSamples,
	mockListSampleGroups,
	sampleServerFnMocks,
} from "@tests/server-fn/samples";
import { mockListSubtractionsShortlist } from "@tests/server-fn/subtractions";
import { mockGetAccount, mockListUsers } from "@tests/server-fn/users";
import { at, renderWithRouter } from "@tests/setup";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import SamplesList from "../SamplesList";

type SamplesListSearch = {
	createdAfter?: string;
	createdBefore?: string;
	groups?: number[];
	labels?: number[];
	page?: number;
	term?: string;
	users?: number[];
	workflows?: string[];
};

/** Mirrors the route, which maps the `labels` search param onto `filterLabels`. */
function SamplesListHarness({
	initialSearch = { term: "" },
}: {
	initialSearch?: SamplesListSearch;
}) {
	const [search, setSearch] = useState<SamplesListSearch>(initialSearch);

	function handleSetSearch(next: SamplesListSearch) {
		setSearch((prev) => ({ ...prev, ...next }));
	}

	return (
		<SamplesList
			dateFilter={getDateFilter(search.createdAfter, search.createdBefore)}
			filterGroups={search.groups}
			filterLabels={search.labels}
			page={search.page}
			setSearch={handleSetSearch}
			term={search.term}
			users={search.users}
			workflows={search.workflows}
		/>
	);
}

/**
 * Serves a one-sample page for each of two pages, so a selection can be made on
 * one page and asserted on from the other.
 *
 * @returns The sample on each page, in page order
 */
function mockSamplePages() {
	const samples = [
		createFakeSampleMinimal({ name: "Page One Sample" }),
		createFakeSampleMinimal({ name: "Page Two Sample" }),
	] as const;

	mockFindSamplePages(samples.map((sample) => [sample]));

	mockFindHmms(createFakeHmmSearchResults());
	mockListReadyIndexes([createFakeIndexMinimal()]);
	mockListSubtractionsShortlist([createFakeSubtractionNested()]);

	return samples;
}

/**
 * Serves a single page of named samples, so a contiguous range can be
 * shift-selected within one page.
 *
 * @returns The sample documents, in page order
 */
function mockSampleRange(names: string[]) {
	const documents = names.map((name) => createFakeSampleMinimal({ name }));

	mockFindHmms(createFakeHmmSearchResults());
	mockListReadyIndexes([createFakeIndexMinimal()]);
	mockListSubtractionsShortlist([createFakeSubtractionNested()]);
	mockFindSamples(documents);

	return documents;
}

describe("<SamplesList />", () => {
	let samples: ReturnType<typeof createFakeSampleMinimal>[];
	let labels: ReturnType<typeof createFakeLabel>[];
	let users: ReturnType<typeof createFakeUserNested>[];
	const path = "/samples";

	beforeEach(() => {
		samples = [createFakeSampleMinimal(), createFakeSampleMinimal()];
		labels = [createFakeLabel()];
		// Handles are fixed so neither is a substring of the other, keeping the
		// search-input assertions unambiguous.
		users = [
			{ ...createFakeUserNested(), handle: "amelia" },
			{ ...createFakeUserNested(), handle: "bilbo" },
		];
		mockListUsers(users);
		mockFindLabels(labels);
		mockFindSamples(samples);
		mockListSampleGroups();
		mockFindHmms(createFakeHmmSearchResults());
		mockListReadyIndexes([createFakeIndexMinimal()]);
		mockListSubtractionsShortlist([createFakeSubtractionNested()]);
	});

	it("should render the list without a create button for a user who cannot modify", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		await renderWithRouter(<SamplesList />, path);
		expect(await screen.findByText("Samples")).toBeInTheDocument();

		expect(screen.getByText(at(samples, 0).name)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Labels" })).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Create" }),
		).not.toBeInTheDocument();
	});

	it("should render create button when [canModify=true]", async () => {
		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		await renderWithRouter(<SamplesList />, path);

		expect(
			await screen.findByRole("link", { name: "Create" }),
		).toBeInTheDocument();
	});

	describe("pagination reset", () => {
		it("should show a term chip and return to the first page when the search term changes", async () => {
			const [first, second] = mockSamplePages();

			await renderWithRouter(
				<SamplesListHarness initialSearch={{ page: 2, term: "" }} />,
				path,
			);
			expect(await screen.findByText(second.name)).toBeInTheDocument();

			await userEvent.type(screen.getByPlaceholderText("Sample name"), "Foo");

			expect(await screen.findByText(first.name)).toBeInTheDocument();
			expect(sampleServerFnMocks.findSamplesFn).toHaveBeenLastCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ page: 1, term: "Foo" }),
				}),
			);
			expect(
				screen.getByRole("button", { name: "Clear search term" }),
			).toBeInTheDocument();
			expect(screen.getByText("Search")).toBeInTheDocument();
		});

		it("should return to the first page when an individual filter is cleared", async () => {
			const [first, second] = mockSamplePages();
			const label = at(labels, 0);

			await renderWithRouter(
				<SamplesListHarness
					initialSearch={{ labels: [label.id], page: 2, term: "" }}
				/>,
				path,
			);
			expect(await screen.findByText(second.name)).toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("button", {
					name: `Remove ${label.name} label filter`,
				}),
			);

			expect(await screen.findByText(first.name)).toBeInTheDocument();
			expect(sampleServerFnMocks.findSamplesFn).toHaveBeenLastCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ labels: [], page: 1 }),
				}),
			);
		});
	});

	it("should add a chip for a label picked in the dropdown and remove it on clear", async () => {
		await renderWithRouter(<SamplesListHarness />, path);
		expect(await screen.findByText("Samples")).toBeInTheDocument();

		const label = at(labels, 0);
		const removeChipName = `Remove ${label.name} label filter`;

		await userEvent.click(screen.getByRole("button", { name: "Labels" }));
		await userEvent.click(
			await screen.findByRole("option", { name: label.name }),
		);
		expect(
			await screen.findByRole("button", { name: removeChipName }),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Clear" }));

		expect(
			screen.queryByRole("button", { name: removeChipName }),
		).not.toBeInTheDocument();
	});

	it("should add a chip for a group picked in the popover and remove it on clear", async () => {
		const group = createFakeGroupMinimal();
		mockListSampleGroups([group]);
		await renderWithRouter(<SamplesListHarness />, path);
		expect(await screen.findByText("Samples")).toBeInTheDocument();

		const removeChipName = `Remove ${group.name} group filter`;

		await userEvent.click(screen.getByRole("button", { name: "Groups" }));
		await userEvent.click(
			await screen.findByRole("option", { name: group.name }),
		);
		expect(
			await screen.findByRole("button", { name: removeChipName }),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Clear" }));

		expect(
			screen.queryByRole("button", { name: removeChipName }),
		).not.toBeInTheDocument();
	});

	describe("date filtering", () => {
		const lastYear = new Date().getFullYear() - 1;

		// The Created sort column is also a button, so scope to the filter bar.
		function openCreatedFilter() {
			const filters = screen.getByRole("group", { name: "Filters" });
			return userEvent.click(
				within(filters).getByRole("button", { name: "Created" }),
			);
		}

		it("should request a picked month or year and remove the chip on clear", async () => {
			await renderWithRouter(<SamplesListHarness />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			await openCreatedFilter();
			await userEvent.click(
				await screen.findByRole("button", { name: "Previous year" }),
			);
			await userEvent.click(
				screen.getByRole("button", { name: `January ${lastYear}` }),
			);

			const chip = await screen.findByRole("button", {
				name: "Clear created filter",
			});
			expect(chip).toMatchTextContent(`January ${lastYear}`);
			expect(sampleServerFnMocks.findSamplesFn).toHaveBeenLastCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						createdAfter: `${lastYear}-01-01`,
						createdBefore: `${lastYear}-01-31`,
					}),
				}),
			);

			await userEvent.click(chip);

			expect(
				screen.queryByRole("button", { name: "Clear created filter" }),
			).not.toBeInTheDocument();

			await openCreatedFilter();
			await userEvent.click(await screen.findByRole("radio", { name: "Year" }));
			await userEvent.click(
				screen.getByRole("button", { name: String(lastYear) }),
			);

			expect(
				await screen.findByRole("button", { name: "Clear created filter" }),
			).toMatchTextContent(String(lastYear));
			expect(sampleServerFnMocks.findSamplesFn).toHaveBeenLastCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						createdAfter: `${lastYear}-01-01`,
						createdBefore: `${lastYear}-12-31`,
					}),
				}),
			);
		});

		it("should show both bounds of a range picked on the calendar", async () => {
			// Seeded with a range so the popover opens on the calendar, showing the
			// month those bounds fall in rather than whichever month today is in.
			await renderWithRouter(
				<SamplesListHarness
					initialSearch={{
						createdAfter: `${lastYear}-03-05`,
						createdBefore: `${lastYear}-03-15`,
						term: "",
					}}
				/>,
				path,
			);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			await openCreatedFilter();

			// Opened on the calendar, which keys each cell by its own ISO date — the
			// only unambiguous handle when two months are shown side by side.
			await screen.findByRole("radio", { name: "Range" });

			async function clickDay(isoDate: string) {
				const day = document.querySelector<HTMLElement>(
					`[data-day="${isoDate}"] button`,
				);

				expect(day).not.toBeNull();
				await userEvent.click(day as HTMLElement);
			}

			await clickDay(`${lastYear}-03-02`);
			await clickDay(`${lastYear}-03-20`);

			expect(
				await screen.findByRole("button", { name: "Clear created filter" }),
			).toMatchTextContent(`${lastYear}-03-02 – ${lastYear}-03-20`);
			expect(sampleServerFnMocks.findSamplesFn).toHaveBeenLastCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						createdAfter: `${lastYear}-03-02`,
						createdBefore: `${lastYear}-03-20`,
					}),
				}),
			);
		});
	});

	it("should add a chip for each workflow state picked in the open menu and remove them on clear", async () => {
		await renderWithRouter(<SamplesListHarness />, path);
		expect(await screen.findByText("Samples")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Workflows" }));

		const item = await screen.findByRole("menuitemcheckbox", {
			name: "Nuvs In progress",
		});
		expect(item).toHaveAttribute("aria-checked", "false");

		await userEvent.click(item);
		await userEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "Nuvs Complete" }),
		);

		expect(
			screen.getByRole("menuitemcheckbox", { name: "Nuvs In progress" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			screen.getByRole("menuitemcheckbox", { name: "Nuvs Complete" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			await screen.findByRole("button", {
				name: "Remove Nuvs Complete filter",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remove Nuvs In progress filter" }),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("menuitem", { name: "Clear" }));

		expect(
			screen.queryByRole("button", { name: /^Remove Nuvs .* filter$/ }),
		).not.toBeInTheDocument();
	});

	describe("user filtering", () => {
		it("should add a chip for each user picked in the open menu and remove them on clear", async () => {
			await renderWithRouter(<SamplesListHarness />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			const [firstUser, secondUser] = [at(users, 0), at(users, 1)];

			await userEvent.click(screen.getByRole("button", { name: "Users" }));
			await userEvent.click(
				await screen.findByRole("option", { name: firstUser.handle }),
			);
			await userEvent.click(
				screen.getByRole("option", { name: secondUser.handle }),
			);

			expect(
				await screen.findByRole("button", {
					name: `Remove ${firstUser.handle} user filter`,
				}),
			).toMatchTextContent(firstUser.handle);
			expect(
				screen.getByRole("button", {
					name: `Remove ${secondUser.handle} user filter`,
				}),
			).toBeInTheDocument();

			await userEvent.click(screen.getByRole("button", { name: "Clear" }));

			expect(
				screen.queryByRole("button", { name: /user filter$/ }),
			).not.toBeInTheDocument();
		});

		it("should list the logged-in user first and narrow the others by search", async () => {
			const self = at(users, 1);
			const other = at(users, 0);
			mockGetAccount(createFakeAccount({ id: self.id, handle: self.handle }));
			await renderWithRouter(<SamplesListHarness />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			await userEvent.click(screen.getByRole("button", { name: "Users" }));

			const items = await screen.findAllByRole("option");
			expect(items.map((item) => item.textContent)).toEqual([
				`${self.handle}You`,
				other.handle,
			]);

			const otherUsers = screen.getByTestId("other-users");
			expect(otherUsers).not.toContainElement(at(items, 0));
			expect(otherUsers).toContainElement(at(items, 1));

			await userEvent.type(screen.getByLabelText("Filter users"), self.handle);

			expect(
				screen.queryByRole("option", { name: other.handle }),
			).not.toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: new RegExp(self.handle) }),
			).toBeInTheDocument();
		});
	});

	describe("select all", () => {
		it("should count matching samples, then the selection, with a mixed state for a partial one", async () => {
			mockFindSamples(samples, { foundCount: 2, totalCount: 17 });
			await renderWithRouter(<SamplesList />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			expect(screen.getByText("2 samples")).toBeInTheDocument();
			expect(screen.queryByText("17 samples")).not.toBeInTheDocument();

			const selectAll = screen.getByRole("checkbox", {
				name: "Select all samples",
			});
			expect(selectAll).not.toBeChecked();

			await userEvent.click(
				screen.getByRole("checkbox", { name: `Select ${at(samples, 0).name}` }),
			);
			expect(screen.queryByText("2 samples")).not.toBeInTheDocument();
			expect(screen.getByText("1 selected")).toBeInTheDocument();
			expect(selectAll).toBePartiallyChecked();

			await userEvent.click(
				screen.getByRole("checkbox", { name: `Select ${at(samples, 1).name}` }),
			);
			expect(selectAll).toBeChecked();
		});

		it("should clear the selection when a filter changes", async () => {
			await renderWithRouter(<SamplesListHarness />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("checkbox", { name: `Select ${at(samples, 0).name}` }),
			);
			expect(screen.getByText("1 selected")).toBeInTheDocument();

			const label = at(labels, 0);

			await userEvent.click(screen.getByRole("button", { name: "Labels" }));
			await userEvent.click(
				await screen.findByRole("option", { name: label.name }),
			);

			expect(await screen.findByText("2 samples")).toBeInTheDocument();
			expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
		});
	});

	it("should select a contiguous range when a row is shift-clicked", async () => {
		// One user-event session keeps the held shift modifier across to the
		// click; the default per-call helpers reset it.
		const user = userEvent.setup();
		const range = mockSampleRange([
			"Range Sample 1",
			"Range Sample 2",
			"Range Sample 3",
			"Range Sample 4",
		]);
		await renderWithRouter(<SamplesList />, path);
		expect(await screen.findByText("Samples")).toBeInTheDocument();

		function checkboxFor(name: string) {
			return screen.getByRole("checkbox", { name: `Select ${name}` });
		}

		await user.click(checkboxFor(at(range, 0).name));
		await user.keyboard("{Shift>}");
		await user.click(checkboxFor(at(range, 2).name));
		await user.keyboard("{/Shift}");

		expect(checkboxFor(at(range, 0).name)).toBeChecked();
		expect(checkboxFor(at(range, 1).name)).toBeChecked();
		expect(checkboxFor(at(range, 2).name)).toBeChecked();
		expect(checkboxFor(at(range, 3).name)).not.toBeChecked();
		expect(screen.getByText("3 selected")).toBeInTheDocument();
	});

	describe("quick analyze", () => {
		it("should analyze only the clicked row and keep the selection", async () => {
			await renderWithRouter(<SamplesList />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			const selectedSample = at(samples, 0);
			const clickedSample = at(samples, 1);

			await userEvent.click(
				screen.getByRole("checkbox", { name: `Select ${selectedSample.name}` }),
			);
			await userEvent.click(
				screen.getByRole("button", {
					name: `Quick analyze ${clickedSample.name}`,
				}),
			);

			const dialog = await screen.findByRole("dialog");

			expect(within(dialog).getByText(clickedSample.name)).toBeInTheDocument();
			expect(
				within(dialog).queryByText(selectedSample.name),
			).not.toBeInTheDocument();
			expect(within(dialog).getByText("Selected Sample")).toBeInTheDocument();
			expect(
				within(dialog).queryByText("Selected Samples"),
			).not.toBeInTheDocument();

			await userEvent.keyboard("{Escape}");
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

			expect(
				screen.getByRole("checkbox", { name: `Select ${selectedSample.name}` }),
			).toBeChecked();
			expect(
				screen.getByRole("checkbox", { name: `Select ${clickedSample.name}` }),
			).not.toBeChecked();
		});

		it("should analyze every selected sample, across pages, from the header", async () => {
			const [first, second] = mockSamplePages();

			await renderWithRouter(<SamplesListHarness />, path);
			expect(await screen.findByText("Samples")).toBeInTheDocument();

			expect(
				screen.queryByRole("button", { name: "Analyze" }),
			).not.toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("checkbox", { name: `Select ${first.name}` }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Analyze" }));

			const singleDialog = await screen.findByRole("dialog");
			expect(
				within(within(singleDialog).getByText("Selected Samples")).getByText(
					"1",
				),
			).toBeInTheDocument();

			await userEvent.keyboard("{Escape}");
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

			await userEvent.click(screen.getByRole("button", { name: "2" }));
			expect(await screen.findByText(second.name)).toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("checkbox", { name: `Select ${second.name}` }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Analyze" }));

			const dialog = await screen.findByRole("dialog");

			const title = within(dialog).getByText("Selected Samples");
			expect(within(title).getByText("2")).toBeInTheDocument();
			expect(within(dialog).getByText(first.name)).toBeInTheDocument();
			expect(within(dialog).getByText(second.name)).toBeInTheDocument();
		});
	});

	describe("empty state", () => {
		beforeEach(() => {
			// Overrides the populated list the outer `beforeEach` queued.
			mockFindSamples([]);
			mockFindHmms(createFakeHmmSearchResults());
			mockListReadyIndexes([createFakeIndexMinimal()]);
			mockListSubtractionsShortlist([createFakeSubtractionNested()]);
		});

		it("should say no samples exist when no filters are active", async () => {
			await renderWithRouter(<SamplesListHarness />, path);

			expect(await screen.findByText("No samples")).toBeInTheDocument();
			expect(
				screen.getByText("No samples have been created yet."),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Clear filters" }),
			).not.toBeInTheDocument();
		});

		it.each([
			["a search term", { term: "ferret" }],
			["a user", { users: [1] }],
		])("should say no samples match when %s is active", async (_, search) => {
			await renderWithRouter(
				<SamplesListHarness initialSearch={search} />,
				path,
			);

			expect(
				await screen.findByText("No matching samples"),
			).toBeInTheDocument();
			expect(
				screen.getByText("No samples match the current filters."),
			).toBeInTheDocument();
			expect(screen.queryByText("No samples")).not.toBeInTheDocument();
		});

		it("should clear every filter when clear filters is clicked", async () => {
			await renderWithRouter(
				<SamplesListHarness
					initialSearch={{ labels: [at(labels, 0).id], term: "ferret" }}
				/>,
				path,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Clear filters" }),
			);

			expect(await screen.findByText("No samples")).toBeInTheDocument();
			expect(screen.getByPlaceholderText("Sample name")).toHaveValue("");
			expect(
				screen.queryByRole("button", { name: "Remove user filter" }),
			).not.toBeInTheDocument();
		});
	});
});
