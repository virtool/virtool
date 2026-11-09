import AnalysisNotReady from "@analyses/components/AnalysisNotReady";
import { screen } from "@testing-library/react";
import { createFakeJobNested } from "@tests/fake/jobs";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import type { JobState } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

describe("<AnalysisNotReady />", () => {
	function renderWithJob(state: JobState) {
		const job = {
			...createFakeJobNested({ state }),
			workflow: "nuvs" as const,
		};

		renderWithProviders(
			<MemoryRouter>
				<AnalysisNotReady job={job} />
			</MemoryRouter>,
		);

		return job;
	}

	it.each<JobState>(["pending", "running"])(
		"shows progress while the job is %s",
		async (state) => {
			renderWithJob(state);

			expect(
				await screen.findByText("Analysis in progress"),
			).toBeInTheDocument();
			expect(screen.queryByRole("link")).not.toBeInTheDocument();
		},
	);

	it("shows progress when the analysis has no job", async () => {
		renderWithProviders(
			<MemoryRouter>
				<AnalysisNotReady job={null} />
			</MemoryRouter>,
		);

		expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
	});

	it.each<[JobState, string]>([
		["failed", "Analysis failed"],
		["cancelled", "Analysis cancelled"],
		["succeeded", "Analysis did not finish"],
	])("links to the job when it %s", async (state, message) => {
		const job = renderWithJob(state);

		expect(await screen.findByText(message)).toBeInTheDocument();
		expect(screen.queryByText("Analysis in progress")).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
			"href",
			`/jobs/${job.id}`,
		);
	});

	it("explains that a succeeded job did not save its results", async () => {
		renderWithJob("succeeded");

		expect(
			await screen.findByText(
				"The job succeeded, but its results were not saved.",
			),
		).toBeInTheDocument();
	});
});
