import type {
	Environment,
	ServiceState,
	SharedState,
} from "../shared/types.ts";
import type { CommandRunner } from "./command.ts";
import { validateOwnership } from "./ownership.ts";

type ComposeContainer = {
	Health?: string;
	Service: string;
	State: string;
};

function parseJsonLines<T>(value: string): T[] {
	return value
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as T);
}

/** Docker and Compose observation through their installed CLIs. */
export class DockerObserver {
	constructor(private readonly run: CommandRunner) {}

	async inspectEnvironment(
		project: string,
		composeFile: string,
		cwd: string,
	): Promise<{
		ready: boolean;
		services: Record<string, ServiceState>;
		state: Environment["observed"];
	}> {
		try {
			const { stdout } = await this.run(
				"docker",
				[
					"compose",
					"--project-name",
					project,
					"--file",
					composeFile,
					"ps",
					"--format",
					"json",
				],
				{ cwd },
			);
			const containers = parseJsonLines<ComposeContainer>(stdout);
			if (containers.length === 0) {
				return { ready: false, services: {}, state: "stopped" };
			}
			const services: Record<string, ServiceState> = {};
			for (const container of containers) {
				services[container.Service] =
					container.State !== "running"
						? "stopped"
						: container.Health && container.Health !== "healthy"
							? "unhealthy"
							: "healthy";
			}
			const running = containers.filter(
				(container) => container.State === "running",
			);
			const ready =
				running.some((container) => container.Service === "web") &&
				running.every(
					(container) => !container.Health || container.Health === "healthy",
				);
			return {
				ready,
				services,
				state: running.length === containers.length ? "running" : "stopped",
			};
		} catch {
			return { ready: false, services: {}, state: "missing" };
		}
	}

	async inspectShared(
		project: string,
		composeFile: string,
		cwd: string,
	): Promise<SharedState> {
		try {
			const { stdout } = await this.run(
				"docker",
				[
					"compose",
					"--project-name",
					project,
					"--file",
					composeFile,
					"ps",
					"--format",
					"json",
				],
				{ cwd },
			);
			const services: SharedState["services"] = {};
			for (const container of parseJsonLines<ComposeContainer>(stdout)) {
				services[container.Service] =
					container.State !== "running"
						? "stopped"
						: container.Health && container.Health !== "healthy"
							? "unhealthy"
							: "healthy";
			}
			return {
				initialized: Object.keys(services).length > 0,
				lastError: null,
				services,
			};
		} catch (error) {
			return {
				initialized: false,
				lastError: error instanceof Error ? error.message : String(error),
				services: {},
			};
		}
	}

	async validateProjectOwnership(
		project: string,
		expected: {
			environmentId: string;
			generation: number;
			repositoryId: string;
		},
	): Promise<void> {
		const { stdout } = await this.run("docker", [
			"ps",
			"--all",
			"--filter",
			`label=com.docker.compose.project=${project}`,
			"--format",
			"{{.ID}}",
		]);
		for (const id of stdout.split("\n").filter(Boolean)) {
			const inspected = await this.run("docker", [
				"inspect",
				"--format",
				"{{json .Config.Labels}}",
				id,
			]);
			validateOwnership(
				JSON.parse(inspected.stdout) as Record<string, string>,
				expected,
			);
		}
	}
}
