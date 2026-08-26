import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeJobMinimal } from "@tests/fake/jobs";
import { createFakeSampleMinimal } from "@tests/fake/samples";
import {
	mockFindAnalyses,
	mockFindRecentlyViewedAnalyses,
} from "@tests/server-fn/analyses";
import { mockFindJobs } from "@tests/server-fn/jobs";
import {
	mockFindRecentlyViewedSamples,
	mockFindSamples,
} from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";
import Dashboard from "../Dashboard";

type CardTables = [
	samples: HTMLElement,
	analyses: HTMLElement,
	jobs: HTMLElement,
];

/** The three card tables, in page order, once every card has loaded. */
async function findTables(): Promise<CardTables> {
	await waitFor(() => {
		expect(screen.getAllByRole("table")).toHaveLength(3);
	});

	return screen.getAllByRole("table") as CardTables;
}

function getColumnLabels(table: HTMLElement) {
	return within(table)
		.getAllByRole("columnheader")
		.map((header) => header.textContent);
}

describe("<Dashboard />", () => {
	const account = createFakeAccount();

	beforeEach(() => {
		mockGetAccount(account);
		mockFindRecentlyViewedSamples([]);
		mockFindRecentlyViewedAnalyses([]);
		mockFindSamples([]);
		mockFindAnalyses([]);
		mockFindJobs([]);
	});

	it("renders every card under the view heading", async () => {
		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByRole("heading", { name: "Dashboard" }),
		).toBeInTheDocument();

		expect(
			await screen.findByRole("heading", { name: "Samples" }),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("heading", { name: "Analyses" }),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("heading", { name: "Active jobs" }),
		).toBeInTheDocument();
	});

	it("defaults each card to the reader's recently viewed items", async () => {
		const findViewedSamples = mockFindRecentlyViewedSamples([]);
		const findViewedAnalyses = mockFindRecentlyViewedAnalyses([]);

		await renderWithRouter(<Dashboard />);

		await waitFor(() => {
			expect(findViewedSamples).toHaveBeenCalledWith({ data: { perPage: 10 } });
		});
		await waitFor(() => {
			expect(findViewedAnalyses).toHaveBeenCalledWith({
				data: { perPage: 10 },
			});
		});
	});

	it("toggles a card to the reader's created items", async () => {
		mockFindRecentlyViewedSamples([
			createFakeSampleMinimal({ name: "Viewed sample" }),
		]);
		const findSamples = mockFindSamples([
			createFakeSampleMinimal({ name: "Created sample" }),
		]);

		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByRole("link", { name: "Viewed sample" }),
		).toBeInTheDocument();

		await userEvent.click(
			within(screen.getByRole("region", { name: "Samples" })).getByRole(
				"radio",
				{ name: "Created" },
			),
		);

		expect(
			await screen.findByRole("link", { name: "Created sample" }),
		).toBeInTheDocument();

		expect(findSamples).toHaveBeenCalledWith({
			data: expect.objectContaining({ users: [account.id] }),
		});
	});

	it("asks for the pending and running jobs, account-wide", async () => {
		const findJobs = mockFindJobs([]);

		await renderWithRouter(<Dashboard />);

		await waitFor(() => {
			expect(findJobs).toHaveBeenCalledWith({
				data: { page: 1, perPage: 10, states: ["pending", "running"] },
			});
		});
	});

	it("lists the recently viewed samples, analyses, and active jobs", async () => {
		mockFindRecentlyViewedSamples([
			createFakeSampleMinimal({ name: "Foo sample" }),
		]);
		mockFindRecentlyViewedAnalyses([
			createFakeAnalysisMinimal({ id: 12, workflow: "pathoscope" }),
		]);
		mockFindJobs([createFakeJobMinimal({ id: 7, workflow: "nuvs" })]);

		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByRole("link", { name: "Foo sample" }),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("link", { name: "Pathoscope" }),
		).toBeInTheDocument();
		expect(await screen.findByRole("link", { name: "Nuvs" })).toHaveAttribute(
			"href",
			"/jobs/7",
		);
	});

	it("names the columns of every card's table", async () => {
		mockFindRecentlyViewedSamples([createFakeSampleMinimal()]);
		mockFindRecentlyViewedAnalyses([createFakeAnalysisMinimal()]);
		mockFindJobs([createFakeJobMinimal()]);

		await renderWithRouter(<Dashboard />);

		const [samples, analyses, jobs] = await findTables();

		expect(samples).toHaveAccessibleName("Samples");
		expect(getColumnLabels(samples)).toEqual(["Sample", "Analyses", "Created"]);

		expect(analyses).toHaveAccessibleName("Analyses");
		expect(getColumnLabels(analyses)).toEqual([
			"Workflow",
			"Sample",
			"Created",
		]);

		expect(jobs).toHaveAccessibleName("Active jobs");
		expect(getColumnLabels(jobs)).toEqual(["Workflow", "State", "Created"]);
	});

	it("ends every card's table with the created time, and no attribution", async () => {
		mockFindRecentlyViewedSamples([createFakeSampleMinimal()]);
		mockFindRecentlyViewedAnalyses([createFakeAnalysisMinimal()]);
		mockFindJobs([createFakeJobMinimal()]);

		await renderWithRouter(<Dashboard />);

		for (const table of await findTables()) {
			// Skip the header row, which holds column headers rather than cells.
			for (const row of within(table).getAllByRole("row").slice(1)) {
				const cells = within(row).getAllByRole("cell");

				expect(cells).toHaveLength(3);

				// Just the time: the "created" the attribution used to read is now
				// only in the column header.
				expect(cells[2]).toHaveTextContent(/ago|just now/);
				expect(cells[2]).not.toHaveTextContent(/created/i);
			}
		}
	});

	it("names the parent sample of each analysis", async () => {
		const sample = createFakeSampleMinimal({ name: "Parent sample" });

		mockFindRecentlyViewedAnalyses([
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		]);

		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByRole("link", { name: "Parent sample" }),
		).toHaveAttribute("href", `/samples/${sample.id}`);
	});

	it("sends Active jobs' View all to the account-wide jobs list", async () => {
		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByRole("link", { name: "View all" }),
		).toHaveAttribute("href", "/jobs");
	});

	it("accounts for the viewed rows a card has no room for", async () => {
		mockFindRecentlyViewedSamples([createFakeSampleMinimal()], {
			foundCount: 14,
		});
		mockFindRecentlyViewedAnalyses([createFakeAnalysisMinimal()], 3);
		mockFindJobs([createFakeJobMinimal()], 2);

		await renderWithRouter(<Dashboard />);

		// No global "recently viewed" list to send the reader to, so the overflow
		// rows are counts rather than links.
		expect(
			await screen.findByText("13 more samples are not shown"),
		).toBeInTheDocument();
		expect(
			await screen.findByText("2 more analyses are not shown"),
		).toBeInTheDocument();

		expect(
			await screen.findByRole("link", { name: "View 1 more active job" }),
		).toBeInTheDocument();
	});

	it("links the created samples a card has no room for to the filtered list", async () => {
		mockFindRecentlyViewedSamples([createFakeSampleMinimal()]);
		mockFindSamples([createFakeSampleMinimal()], { foundCount: 14 });

		await renderWithRouter(<Dashboard />);

		await userEvent.click(
			within(await screen.findByRole("region", { name: "Samples" })).getByRole(
				"radio",
				{ name: "Created" },
			),
		);

		expect(
			await screen.findByRole("link", {
				name: "View 13 more samples of yours",
			}),
		).toHaveAttribute("href", `/samples?users=%5B${account.id}%5D`);
	});

	it("omits the overflow row when a card is showing everything", async () => {
		mockFindRecentlyViewedSamples([createFakeSampleMinimal()]);
		mockFindRecentlyViewedAnalyses([createFakeAnalysisMinimal()]);
		mockFindJobs([createFakeJobMinimal()]);

		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByRole("heading", { name: "Samples" }),
		).toBeInTheDocument();
		expect(screen.queryByText(/more/)).toBeNull();
	});

	it("shows an empty state per card when there is nothing to list", async () => {
		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByText("No samples viewed yet"),
		).toBeInTheDocument();
		expect(
			await screen.findByText("No analyses viewed yet"),
		).toBeInTheDocument();
		expect(await screen.findByText("Nothing running")).toBeInTheDocument();
	});

	it("contains a failed card without taking down the rest of the dashboard", async () => {
		mockFindRecentlyViewedAnalyses([]).mockRejectedValue(new Error("boom"));
		mockFindRecentlyViewedSamples([
			createFakeSampleMinimal({ name: "Foo sample" }),
		]);

		await renderWithRouter(<Dashboard />);

		expect(
			await screen.findByText("Couldn't load analyses."),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("link", { name: "Foo sample" }),
		).toBeInTheDocument();
	});
});
