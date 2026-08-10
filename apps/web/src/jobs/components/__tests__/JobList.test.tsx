import { screen } from "@testing-library/react";
import { createFakeJobMinimal } from "@tests/fake/jobs";
import { mockFindJobs } from "@tests/server-fn/jobs";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<JobsList />", () => {
	it("should render", async () => {
		const findJobs = mockFindJobs([
			createFakeJobMinimal({
				progress: 100,
				state: "succeeded",
				workflow: "create_sample",
			}),
		]);

		await renderRoute("/jobs");

		const job = await screen.findByText("Create Sample");
		expect(job).toBeInTheDocument();

		// The job is a list item within a semantic list.
		expect(job.closest("li")).not.toBeNull();

		expect(findJobs).toHaveBeenCalled();
	});

	it("should show message when there are no unarchived jobs", async () => {
		const findJobs = mockFindJobs([]);

		await renderRoute("/jobs");

		expect(await screen.findByText("No jobs found")).toBeInTheDocument();

		expect(findJobs).toHaveBeenCalled();
	});

	it("should show message when no jobs match filters", async () => {
		const findJobs = mockFindJobs(
			[createFakeJobMinimal({ progress: 100, state: "succeeded" })],
			0,
		);

		await renderRoute("/jobs");

		expect(
			await screen.findByText("No jobs match your filters."),
		).toBeInTheDocument();

		expect(findJobs).toHaveBeenCalled();
	});
});
