import JobSteps from "@jobs/components/JobSteps";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<JobSteps />", () => {
	it("renders an informative box before the job is claimed", () => {
		renderWithProviders(
			<JobSteps finishedAt={null} state="pending" steps={null} />,
		);

		expect(screen.getByText("Waiting for a runner")).toBeInTheDocument();
		expect(
			screen.getByText(
				"This job is queued. Its steps will appear when a runner claims it.",
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});

	it("should render", () => {
		renderWithProviders(
			<JobSteps
				finishedAt={new Date("2024-04-12T21:53:19.108000Z")}
				state="running"
				steps={[
					{
						id: "download_files",
						name: "Download files",
						description: "Downloading reference files",
						startedAt: new Date("2024-04-12T21:50:19.108000Z"),
					},
					{
						id: "build_index",
						name: "Build index",
						description: "Building search index",
						startedAt: new Date("2024-04-12T21:51:19.108000Z"),
					},
				]}
			/>,
		);

		expect(screen.getByText("Download files")).toBeInTheDocument();
		expect(screen.getByText("Downloading reference files")).toBeInTheDocument();
		expect(screen.getByText("Build index")).toBeInTheDocument();
		expect(screen.getByText("Building search index")).toBeInTheDocument();
		expect(screen.getByRole("table")).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Status" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Elapsed" }),
		).toBeInTheDocument();
		expect(screen.getByText("00:01:00")).toBeInTheDocument();
		expect(screen.getByText("00:02:00")).toBeInTheDocument();
		const runningRow = screen.getByText("Build index").closest("tr");
		expect(runningRow?.querySelector("svg")).toHaveClass(
			"lucide-loader-circle",
			"animate-spin",
		);
	});

	it("renders claimed steps that have not started", () => {
		const { rerender } = renderWithProviders(
			<JobSteps
				finishedAt={null}
				state="running"
				steps={[
					{
						id: "download_files",
						name: "Download files",
						description: "Downloading reference files",
						startedAt: new Date("2024-04-12T21:50:19.108000Z"),
					},
					{
						id: "build_index",
						name: "Build index",
						description: "Building search index",
						startedAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText("Download files")).toBeInTheDocument();
		const pendingRow = screen.getByText("Build index").closest("tr");
		expect(pendingRow).toHaveClass("text-muted");
		expect(pendingRow?.querySelector("svg")).toHaveClass("stroke-current");
		expect(screen.getByText("pending")).toBeInTheDocument();

		rerender(
			<JobSteps
				finishedAt={null}
				state="pending"
				steps={[
					{
						id: "download_files",
						name: "Download files",
						description: "Downloading reference files",
						startedAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText("Download files")).toBeInTheDocument();
	});

	it("should escape HTML in a step description", () => {
		const description = `Downloading <img src="x" onerror="alert(1)"> files`;

		const { container } = renderWithProviders(
			<JobSteps
				finishedAt={null}
				state="running"
				steps={[
					{
						id: "download_files",
						name: "Download files",
						description,
						startedAt: new Date("2024-04-12T21:50:19.108000Z"),
					},
				]}
			/>,
		);

		expect(container.querySelector("img")).toBeNull();
		expect(screen.getByText(description)).toBeInTheDocument();
	});

	it("renders the terminal state when the job recorded no steps", () => {
		renderWithProviders(
			<JobSteps
				finishedAt={new Date("2024-04-12T21:53:19.108000Z")}
				state="succeeded"
				steps={null}
			/>,
		);

		expect(screen.getByText("Succeeded")).toBeInTheDocument();
		expect(screen.getByText(/This job finished/)).toBeInTheDocument();
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});

	it("renders the terminal state when the job failed before its first step", () => {
		renderWithProviders(
			<JobSteps
				finishedAt={new Date("2024-04-12T21:53:19.108000Z")}
				state="failed"
				steps={[
					{
						id: "eliminate_otus",
						name: "Eliminate OTUs",
						description: "Mapping reads to the reference",
						startedAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText("Failed")).toBeInTheDocument();
		expect(screen.getByText(/This job finished/)).toBeInTheDocument();
		expect(screen.getByRole("table")).toBeInTheDocument();
		expect(screen.getByText("Eliminate OTUs").closest("tr")).toHaveClass(
			"text-muted",
		);
	});
});
