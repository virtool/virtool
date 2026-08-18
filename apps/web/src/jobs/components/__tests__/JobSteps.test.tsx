import JobSteps from "@jobs/components/JobSteps";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<JobSteps />", () => {
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
		expect(screen.getByText("1 minute")).toBeInTheDocument();
		expect(screen.getByText("2 minutes")).toBeInTheDocument();
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
});
