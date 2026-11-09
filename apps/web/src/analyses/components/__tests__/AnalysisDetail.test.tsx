import { jobQueryKeys } from "@jobs/keys";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeJobNested } from "@tests/fake/jobs";
import { createFakeSample } from "@tests/fake/samples";
import { analysisServerFnMocks } from "@tests/server-fn/analyses";
import { mockGetSample } from "@tests/server-fn/samples";
import {
	createTestQueryClient,
	MemoryRouter,
	renderWithProviders,
} from "@tests/setup";
import type { AnalysisJobNested, JobState } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	getRouteApi: () => ({
		useParams: () => ({ analysisId: "1", sampleId: "2" }),
	}),
}));

import AnalysisDetail from "../AnalysisDetail";

function createJob(state: JobState): AnalysisJobNested {
	return { ...createFakeJobNested({ state }), workflow: "pathoscope" };
}

function mockUnreadyAnalysis(job: AnalysisJobNested | null) {
	analysisServerFnMocks.getAnalysisFn.mockResolvedValue({
		...createFakeAnalysisMinimal({ job, ready: false }),
		files: [],
	});
}

/** Render the page with `state` already cached as the job's live state. */
function renderWithCachedJob(job: AnalysisJobNested, state: JobState) {
	const queryClient = createTestQueryClient();
	queryClient.setQueryData(jobQueryKeys.detail(job.id), { ...job, state });

	renderWithProviders(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter>
				<AnalysisDetail />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("<AnalysisDetail />", () => {
	beforeEach(() => {
		mockGetSample(createFakeSample());
	});

	function renderDetail() {
		renderWithProviders(
			<MemoryRouter>
				<AnalysisDetail />
			</MemoryRouter>,
		);
	}

	it("shows a failed analysis with a link to its job", async () => {
		const job = createJob("failed");
		mockUnreadyAnalysis(job);

		renderDetail();

		expect(await screen.findByText("Analysis failed")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
			"href",
			`/jobs/${job.id}`,
		);
		expect(screen.queryByText("Analysis in progress")).not.toBeInTheDocument();
	});

	it("shows a cancelled analysis with a link to its job", async () => {
		const job = createJob("cancelled");
		mockUnreadyAnalysis(job);

		renderDetail();

		expect(await screen.findByText("Analysis cancelled")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
			"href",
			`/jobs/${job.id}`,
		);
	});

	it("shows a succeeded job's unready analysis as unfinished", async () => {
		const job = createJob("succeeded");
		mockUnreadyAnalysis(job);

		renderDetail();

		expect(
			await screen.findByText("Analysis did not finish"),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
			"href",
			`/jobs/${job.id}`,
		);
		expect(screen.queryByText("Analysis in progress")).not.toBeInTheDocument();
	});

	it.each<JobState>(["pending", "running"])(
		"shows an unready analysis as in progress while its job is %s",
		async (state) => {
			mockUnreadyAnalysis(createJob(state));

			renderDetail();

			expect(
				await screen.findByText("Analysis in progress"),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("link", { name: "View job" }),
			).not.toBeInTheDocument();
		},
	);

	it("shows an unready analysis with no job as in progress", async () => {
		mockUnreadyAnalysis(null);

		renderDetail();

		expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
	});

	it("shows a failure the job query knows of before the analysis does", async () => {
		const job = createJob("running");
		mockUnreadyAnalysis(job);

		renderWithCachedJob(job, "failed");

		expect(await screen.findByText("Analysis failed")).toBeInTheDocument();
	});

	it("shows a failure the job query missed while unmounted", async () => {
		const job = createJob("failed");
		mockUnreadyAnalysis(job);

		renderWithCachedJob(job, "running");

		expect(await screen.findByText("Analysis failed")).toBeInTheDocument();
	});
});
