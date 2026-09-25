import { describe, expect, it, vi } from "vitest";
import type { CommandRunner } from "./command.ts";
import { DockerObserver } from "./docker.ts";

function container(
	project: string,
	service: string,
	{
		oneoff = "False",
		state = "running",
		status = "Up 5 minutes (healthy)",
	}: { oneoff?: string; state?: string; status?: string } = {},
) {
	return [project, service, oneoff, state, status].join("\t");
}

function listing(...lines: string[]) {
	return { stderr: "", stdout: `${lines.join("\n")}\n` };
}

describe("DockerObserver", () => {
	it("requires every core service to be running and healthy", async () => {
		const run = vi.fn<CommandRunner>().mockResolvedValue(
			listing(
				container("project", "jobs-api"),
				container("project", "tasks", {
					state: "exited",
					status: "Exited (1) 2 minutes ago",
				}),
				container("project", "web"),
			),
		);
		const observer = new DockerObserver(run);

		const result = await observer.inspectEnvironment("project");

		expect(result).toEqual({
			ready: false,
			services: { "jobs-api": "healthy", tasks: "stopped", web: "healthy" },
			state: "stopped",
		});
		expect(run).toHaveBeenCalledWith(
			"docker",
			expect.arrayContaining([
				"ps",
				"--all",
				"--filter",
				"label=com.docker.compose.project=project",
			]),
		);
	});

	it("treats starting health checks as unhealthy", async () => {
		const run = vi.fn<CommandRunner>().mockResolvedValue(
			listing(
				container("project", "jobs-api"),
				container("project", "tasks", {
					status: "Up 2 seconds (health: starting)",
				}),
				container("project", "web"),
			),
		);
		const observer = new DockerObserver(run);

		const result = await observer.inspectEnvironment("project");

		expect(result.ready).toBe(false);
		expect(result.services.tasks).toBe("unhealthy");
		expect(result.state).toBe("running");
	});

	it("observes environments and shared services with one listing", async () => {
		const run = vi.fn<CommandRunner>().mockResolvedValue(
			listing(
				container("environment", "jobs-api"),
				container("environment", "tasks"),
				container("environment", "web"),
				container("environment", "migration", {
					oneoff: "True",
					state: "exited",
				}),
				container("shared", "postgres"),
				container("shared", "caddy", { status: "Up 5 minutes" }),
				container("shared", "azurite", { state: "exited" }),
			),
		);
		const observer = new DockerObserver(run);

		const result = await observer.observeRepository("id", "shared", false);

		expect(run).toHaveBeenCalledOnce();
		expect(result.environments.get("environment")).toEqual({
			ready: true,
			services: { "jobs-api": "healthy", tasks: "healthy", web: "healthy" },
			state: "running",
		});
		expect(result.shared).toEqual({
			initialized: true,
			lastError: null,
			services: { caddy: "healthy", postgres: "healthy" },
			storage: { azurite: null, postgres: null },
		});
	});

	it("reports Docker failures", async () => {
		const run = vi
			.fn<CommandRunner>()
			.mockRejectedValue(new Error("Docker is unavailable"));
		const observer = new DockerObserver(run);

		const result = await observer.observeRepository("id", "shared", true);

		expect(result.error).toBe("Docker is unavailable");
		expect(result.shared.lastError).toBe("Docker is unavailable");
	});

	it("reports shared volume usage when requested", async () => {
		const run = vi
			.fn<CommandRunner>()
			.mockResolvedValueOnce(listing(container("shared", "postgres")))
			.mockResolvedValueOnce({
				stderr: "",
				stdout:
					"Local Volumes space usage:\nNAME LINKS SIZE\nvirtool-dev-repository-id-postgres 1 1.5 MB\nvirtool-dev-repository-id-azurite 1 2.5 MB\n",
			});
		const observer = new DockerObserver(run);

		const result = await observer.observeRepository(
			"repository-id",
			"shared",
			true,
		);

		expect(result.shared.storage).toEqual({
			azurite: 2_500_000,
			postgres: 1_500_000,
		});
	});
});
