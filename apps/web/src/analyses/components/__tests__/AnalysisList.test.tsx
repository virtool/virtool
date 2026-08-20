import AnalysesList from "@analyses/components/AnalysisList";
import type { AnalysesListSearch } from "@analyses/listSearch";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeSample } from "@tests/fake/samples";
import { createFakeUserNested } from "@tests/fake/user";
import { mockFindAnalyses } from "@tests/server-fn/analyses";
import { mockFindHmms } from "@tests/server-fn/hmm";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockGetAccount, mockListUsers } from "@tests/server-fn/users";
import { at, MemoryRouter, renderWithProviders } from "@tests/setup";
import type { AnalysisMinimal, AnalysisSortField } from "@virtool/contracts";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mirrors the route, which holds the list's page, ordering, and filters. */
function AnalysesListHarness({
	initialSearch,
	onSearchChange,
	sampleId,
}: {
	initialSearch?: Partial<AnalysesListSearch>;
	onSearchChange?: (search: AnalysesListSearch) => void;
	sampleId: number;
}) {
	const [search, setSearch] = useState<AnalysesListSearch>({
		direction: "descending",
		page: 1,
		users: [],
		workflows: [],
		...initialSearch,
	});

	return (
		<AnalysesList
			direction={search.direction}
			page={search.page}
			sampleId={sampleId}
			setSearch={(next) =>
				setSearch((previous) => {
					const updated = { ...previous, ...next };
					onSearchChange?.(updated);
					return updated;
				})
			}
			sort={search.sort}
			users={search.users}
			workflows={search.workflows}
		/>
	);
}

describe("<AnalysesList />", () => {
	let sample: ReturnType<typeof createFakeSample>;

	beforeEach(() => {
		sample = createFakeSample();
		mockFindAnalyses([
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		]);
		mockFindHmms(createFakeHmmSearchResults());
	});

	function renderList() {
		renderWithProviders(
			<MemoryRouter>
				<AnalysesListHarness sampleId={sample.id} />
			</MemoryRouter>,
		);
	}

	it("should show analysis creation when user is full admin", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(sample);
		renderList();

		const create = await screen.findByRole("button", { name: "Create" });

		expect(create).toBeInTheDocument();
		expect(create.closest("table")).toBeNull();
	});

	it("should keep the count and creation action above the empty state", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(sample);
		mockFindAnalyses([]);
		renderList();

		const count = await screen.findByText("Showing 0 of 0 analyses");
		const create = screen.getByRole("button", { name: "Create" });
		const emptyState = screen.getByText("No analyses found");

		expect(
			count.compareDocumentPosition(emptyState) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			create.compareDocumentPosition(emptyState) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("should show analysis creation when user is the owner of the sample", async () => {
		const account = createFakeAccount({ administratorRole: null });
		sample.user.id = account.id;
		mockGetAccount(account);
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should show analysis creation when user is in the correct group and write is enabled", async () => {
		const account = createFakeAccount({ administratorRole: null });
		sample.group = at(account.groups, 0);
		sample.groupWrite = true;
		mockGetAccount(account);
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should show analysis creation when all users editing a sample is permitted", async () => {
		const account = createFakeAccount({ administratorRole: null });
		sample.allWrite = true;
		mockGetAccount(account);
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
	});

	it("should not render analysis creation option when user has no permissions", async () => {
		sample.allWrite = false;
		sample.groupWrite = false;
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Pathoscope")).toBeInTheDocument();
		expect(screen.queryByText("Create")).not.toBeInTheDocument();
	});
});

describe("<AnalysesList /> table", () => {
	let sample: ReturnType<typeof createFakeSample>;
	let analysis: AnalysisMinimal;

	beforeEach(() => {
		sample = createFakeSample();
		analysis = createFakeAnalysisMinimal({
			index: { id: 12, version: 3 },
			reference: { id: 7, name: "Plant Viruses" },
			sample: { id: sample.id, name: sample.name },
			subtractions: [{ id: 4, name: "Arabidopsis", ready: true }],
		});
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(sample);
		mockFindHmms(createFakeHmmSearchResults());
	});

	function renderTable(props: {
		direction?: "ascending" | "descending";
		onSearchChange?: (search: AnalysesListSearch) => void;
		sort?: AnalysisSortField;
	}) {
		renderWithProviders(
			<MemoryRouter>
				<AnalysesListHarness
					initialSearch={{
						direction: props.direction ?? "descending",
						sort: props.sort,
					}}
					onSearchChange={props.onSearchChange}
					sampleId={sample.id}
				/>
			</MemoryRouter>,
		);
	}

	it("labels every column, including the one with no visible header", async () => {
		mockFindAnalyses([analysis]);
		renderTable({});

		const headers = await screen.findAllByRole("columnheader");

		expect(headers.map((header) => header.textContent)).toEqual([
			"Workflow",
			"Reference",
			"Subtractions",
			"User",
			"Created",
			"Actions",
		]);
	});

	it("shows the reference, index, and subtractions of each analysis", async () => {
		mockFindAnalyses([analysis]);
		renderTable({});

		expect(await screen.findByText("Plant Viruses")).toBeInTheDocument();
		expect(screen.getByText("Index 3")).toBeInTheDocument();
		expect(screen.getByText("Arabidopsis")).toBeInTheDocument();
	});

	it("sorts by an unsorted column ascending", async () => {
		const onSearchChange = vi.fn();

		mockFindAnalyses([analysis]);
		renderTable({ onSearchChange });

		await userEvent.click(
			await screen.findByRole("button", { name: "Workflow" }),
		);

		expect(onSearchChange).toHaveBeenCalledWith(
			expect.objectContaining({ direction: "ascending", sort: "workflow" }),
		);
	});

	it("reverses the column already sorted by", async () => {
		const onSearchChange = vi.fn();

		mockFindAnalyses([analysis]);
		renderTable({ direction: "ascending", onSearchChange, sort: "workflow" });

		await userEvent.click(
			await screen.findByRole("button", { name: "Workflow" }),
		);

		expect(onSearchChange).toHaveBeenCalledWith(
			expect.objectContaining({ direction: "descending", sort: "workflow" }),
		);
	});

	it("marks only the sorted column with a direction", async () => {
		mockFindAnalyses([analysis]);
		renderTable({ direction: "ascending", sort: "createdAt" });

		const headers = await screen.findAllByRole("columnheader");

		expect(headers.map((header) => header.getAttribute("aria-sort"))).toEqual([
			"none",
			null,
			null,
			"none",
			"ascending",
			null,
		]);
	});

	it("requests the sorted column from the server", async () => {
		const findAnalyses = mockFindAnalyses([analysis]);
		renderTable({ direction: "ascending", sort: "user" });

		await waitFor(() => {
			expect(findAnalyses).toHaveBeenCalledWith({
				data: expect.objectContaining({
					direction: "ascending",
					sort: "user",
				}),
			});
		});
	});

	it("requests the default order when no column is sorted by", async () => {
		const findAnalyses = mockFindAnalyses([analysis]);
		renderTable({});

		await waitFor(() => {
			expect(findAnalyses).toHaveBeenCalledWith({
				data: expect.objectContaining({
					direction: "descending",
					sort: undefined,
				}),
			});
		});
	});
});

describe("<AnalysesList /> filtering", () => {
	let sample: ReturnType<typeof createFakeSample>;
	let users: ReturnType<typeof createFakeUserNested>[];

	beforeEach(() => {
		sample = createFakeSample();
		users = [createFakeUserNested(), createFakeUserNested()];
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(sample);
		mockFindHmms(createFakeHmmSearchResults());
		mockListUsers(users);
		mockFindAnalyses([
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		]);
	});

	function renderList(initialSearch?: Partial<AnalysesListSearch>) {
		renderWithProviders(
			<MemoryRouter>
				<AnalysesListHarness
					initialSearch={initialSearch}
					sampleId={sample.id}
				/>
			</MemoryRouter>,
		);
	}

	it("requests the workflows picked in the dropdown", async () => {
		const findAnalyses = mockFindAnalyses([]);
		renderList();

		await userEvent.click(
			await screen.findByRole("button", { name: "Workflows" }),
		);
		await userEvent.click(
			await screen.findByRole("menuitemcheckbox", { name: "Pathoscope" }),
		);
		// The menu stays open, so the second workflow is toggled without
		// reopening it.
		await userEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "Nuvs" }),
		);

		expect(
			await screen.findByRole("button", {
				name: "Remove Pathoscope workflow filter",
			}),
		).toBeInTheDocument();

		await waitFor(() => {
			expect(findAnalyses).toHaveBeenCalledWith({
				data: expect.objectContaining({
					workflows: ["pathoscope", "nuvs"],
				}),
			});
		});
	});

	it("removes a workflow filter by clicking its chip", async () => {
		renderList({ workflows: ["pathoscope"] });

		await userEvent.click(
			await screen.findByRole("button", {
				name: "Remove Pathoscope workflow filter",
			}),
		);

		expect(
			screen.queryByRole("button", {
				name: "Remove Pathoscope workflow filter",
			}),
		).not.toBeInTheDocument();
	});

	it("requests the users picked in the dropdown", async () => {
		const findAnalyses = mockFindAnalyses([]);
		renderList();

		await userEvent.click(await screen.findByRole("button", { name: "Users" }));
		await userEvent.click(
			await screen.findByRole("menuitemcheckbox", {
				name: at(users, 0).handle,
			}),
		);

		expect(
			await screen.findByRole("button", {
				name: `Remove ${at(users, 0).handle} user filter`,
			}),
		).toBeInTheDocument();

		await waitFor(() => {
			expect(findAnalyses).toHaveBeenCalledWith({
				data: expect.objectContaining({ userIds: [at(users, 0).id] }),
			});
		});
	});

	it("offers to clear the filters when they hide every analysis", async () => {
		mockFindAnalyses([]);
		renderList({ workflows: ["nuvs"] });

		expect(await screen.findByText("No matching analyses")).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "Clear filters" }),
		);

		expect(
			screen.queryByRole("button", { name: "Remove Nuvs workflow filter" }),
		).not.toBeInTheDocument();
		expect(screen.getByText("No analyses found")).toBeInTheDocument();
	});
});
