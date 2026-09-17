import { describe, expect, it, vi } from "vitest";
import type { CommandRunner } from "./command.ts";
import { DockerObserver } from "./docker.ts";

function container(Service: string, State = "running", Health = "healthy") {
	return JSON.stringify({ Health, Service, State });
}

describe("DockerObserver", () => {
	it("requires every core service to be running and healthy", async () => {
		const run = vi.fn<CommandRunner>().mockResolvedValue({
			stderr: "",
			stdout: [
				container("jobs-api"),
				container("tasks", "exited", ""),
				container("web"),
			].join("\n"),
		});
		const observer = new DockerObserver(run);

		const result = await observer.inspectEnvironment(
			"project",
			"compose.yaml",
			"/repo",
		);

		expect(result.ready).toBe(false);
		expect(result.services.tasks).toBe("stopped");
		expect(run).toHaveBeenCalledWith(
			"docker",
			expect.arrayContaining(["ps", "--all", "--format", "json"]),
			{ cwd: "/repo" },
		);
	});

	it("reports ready when every core service is healthy", async () => {
		const run = vi.fn<CommandRunner>().mockResolvedValue({
			stderr: "",
			stdout: [
				container("jobs-api"),
				container("tasks"),
				container("web"),
			].join("\n"),
		});
		const observer = new DockerObserver(run);

		const result = await observer.inspectEnvironment(
			"project",
			"compose.yaml",
			"/repo",
		);

		expect(result.ready).toBe(true);
	});
});
