import AnalysesList from "@analyses/components/AnalysisList";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeSample } from "@tests/fake/samples";
import { mockFindAnalyses } from "@tests/server-fn/analyses";
import { mockFindHmms } from "@tests/server-fn/hmm";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { at, MemoryRouter, renderWithProviders } from "@tests/setup";
import type { AnalysisMinimal, AnalysisSortField } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
				<AnalysesList
					direction="descending"
					onPageChange={() => {}}
					onSortChange={() => {}}
					page={1}
					sampleId={sample.id}
				/>
			</MemoryRouter>,
		);
	}

	it("should show analysis creation when user is full admin", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(sample);
		renderList();

		expect(await screen.findByText("Create")).toBeInTheDocument();
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
		onSortChange?: (
			sort: AnalysisSortField,
			direction: "ascending" | "descending",
		) => void;
		sort?: AnalysisSortField;
	}) {
		renderWithProviders(
			<MemoryRouter>
				<AnalysesList
					direction={props.direction ?? "descending"}
					onPageChange={() => {}}
					onSortChange={props.onSortChange ?? (() => {})}
					page={1}
					sampleId={sample.id}
					sort={props.sort}
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
		const onSortChange = vi.fn();

		mockFindAnalyses([analysis]);
		renderTable({ onSortChange });

		await userEvent.click(
			await screen.findByRole("button", { name: "Workflow" }),
		);

		expect(onSortChange).toHaveBeenCalledWith("workflow", "ascending");
	});

	it("reverses the column already sorted by", async () => {
		const onSortChange = vi.fn();

		mockFindAnalyses([analysis]);
		renderTable({ direction: "ascending", onSortChange, sort: "workflow" });

		await userEvent.click(
			await screen.findByRole("button", { name: "Workflow" }),
		);

		expect(onSortChange).toHaveBeenCalledWith("workflow", "descending");
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
