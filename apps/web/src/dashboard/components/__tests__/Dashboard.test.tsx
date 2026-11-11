import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeSampleMinimal } from "@tests/fake/samples";
import {
	mockFindAnalyses,
	mockFindRecentlyViewedAnalyses,
} from "@tests/server-fn/analyses";
import {
	mockFindRecentlyViewedSamples,
	mockFindSamples,
} from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderRoute, renderWithRouter } from "@tests/setup";
import { silenceExpectedLogs } from "@tests/silenceExpectedLogs";
import { Suspense } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import Dashboard from "../Dashboard";

type CardTables = [samples: HTMLElement, analyses: HTMLElement];

/** The two card tables, in page order, once every card has loaded. */
async function findTables(): Promise<CardTables> {
	await waitFor(() => {
		expect(screen.getAllByRole("table")).toHaveLength(2);
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
	});

	function renderDashboard() {
		return renderWithRouter(
			<Suspense>
				<Dashboard
					analysesMode="viewed"
					onAnalysesModeChange={() => {}}
					onSamplesModeChange={() => {}}
					samplesMode="viewed"
				/>
			</Suspense>,
		);
	}

	it("shows every card under the view heading with an empty state when there is nothing to list", async () => {
		await renderDashboard();

		expect(
			await screen.findByRole("heading", { name: "Dashboard" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Recent Samples" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Recent Analyses" }),
		).toBeInTheDocument();
		expect(
			await screen.findByText("No samples viewed yet"),
		).toBeInTheDocument();
		expect(
			await screen.findByText("No analyses viewed yet"),
		).toBeInTheDocument();
	});

	it("lists the recently viewed samples and analyses", async () => {
		const sample = createFakeSampleMinimal({ name: "Parent sample" });
		mockFindRecentlyViewedSamples([
			createFakeSampleMinimal({
				name: "Foo sample",
				user: { handle: "sample-owner", id: 1 },
			}),
		]);
		mockFindRecentlyViewedAnalyses([
			createFakeAnalysisMinimal({
				id: 12,
				sample: { id: sample.id, name: sample.name },
				user: { handle: "analysis-owner", id: 2 },
				workflow: "pathoscope",
			}),
		]);

		await renderDashboard();

		const [samples, analyses] = await findTables();

		expect(samples).toHaveAccessibleName("Recent Samples");
		expect(getColumnLabels(samples)).toEqual([
			"Sample",
			"Analyses",
			"User",
			"Created",
		]);
		expect(
			within(samples).getByRole("link", { name: "Foo sample" }),
		).toBeInTheDocument();
		expect(within(samples).getByText("sample-owner")).toBeInTheDocument();

		expect(analyses).toHaveAccessibleName("Recent Analyses");
		expect(getColumnLabels(analyses)).toEqual([
			"Workflow",
			"Version",
			"Sample",
			"User",
			"Created",
		]);
		expect(
			within(analyses).getByRole("link", { name: "Pathoscope" }),
		).toBeInTheDocument();
		expect(
			within(analyses).getByRole("link", { name: "Parent sample" }),
		).toHaveAttribute("href", `/samples/${sample.id}`);
		expect(within(analyses).getByText("analysis-owner")).toBeInTheDocument();

		for (const table of [samples, analyses]) {
			// Skip the header row, which holds column headers rather than cells.
			for (const row of within(table).getAllByRole("row").slice(1)) {
				const cells = within(row).getAllByRole("cell");
				const lastCell = cells[cells.length - 1];

				// Just the time: "created" is only in the column header.
				expect(lastCell).toMatchTextContent(/ago|just now/);
				expect(lastCell).not.toMatchTextContent(/created/i);
			}
		}

		// Both cards show everything, so neither has an overflow row.
		expect(screen.queryByText(/more/)).toBeNull();
	});

	it("accounts for the viewed rows a card has no room for", async () => {
		mockFindRecentlyViewedSamples([createFakeSampleMinimal()], {
			foundCount: 14,
		});
		mockFindRecentlyViewedAnalyses([createFakeAnalysisMinimal()], 3);

		await renderDashboard();

		// No global "recently viewed" list to send the reader to, so the overflow
		// rows are counts rather than links.
		expect(
			await screen.findByText("13 more samples are not shown"),
		).toBeInTheDocument();
		expect(
			await screen.findByText("2 more analyses are not shown"),
		).toBeInTheDocument();
	});

	it("toggles a card to the reader's created items and links the ones it has no room for", async () => {
		mockFindRecentlyViewedSamples([
			createFakeSampleMinimal({ name: "Viewed sample" }),
		]);
		const findSamples = mockFindSamples(
			[createFakeSampleMinimal({ name: "Created sample" })],
			{ foundCount: 14 },
		);

		await renderRoute("/", { account });

		expect(
			await screen.findByRole("link", { name: "Viewed sample" }),
		).toBeInTheDocument();

		await userEvent.click(
			within(screen.getByRole("region", { name: "Recent Samples" })).getByRole(
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
		expect(
			screen.getByRole("link", { name: "View 13 more samples of yours" }),
		).toHaveAttribute("href", `/samples?users=%5B${account.id}%5D`);
	});

	it("contains a failed card without taking down the rest of the dashboard", async () => {
		silenceExpectedLogs();
		mockFindRecentlyViewedAnalyses([]).mockRejectedValue(new Error("boom"));
		mockFindRecentlyViewedSamples([
			createFakeSampleMinimal({ name: "Foo sample" }),
		]);

		await renderDashboard();

		expect(
			await screen.findByText("Couldn't load analyses."),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("link", { name: "Foo sample" }),
		).toBeInTheDocument();
	});
});
