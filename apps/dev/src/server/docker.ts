import type {
	Environment,
	ServiceState,
	SharedState,
	SharedStorage,
} from "../shared/types.ts";
import type { CommandRunner } from "./command.ts";
import { validateOwnership } from "./ownership.ts";

type ComposeContainer = {
	Health?: string;
	Service: string;
	State: string;
};

const STORAGE_UNITS: Record<string, number> = {
	B: 1,
	kB: 1_000,
	MB: 1_000_000,
	GB: 1_000_000_000,
	TB: 1_000_000_000_000,
	KiB: 1_024,
	MiB: 1_048_576,
	GiB: 1_073_741_824,
	TiB: 1_099_511_627_776,
};

const CORE_SERVICES = ["jobs-api", "tasks", "web"];
const STORAGE_USAGE_INTERVAL_MS = 60_000;

type StorageUsageCache = {
	checkedAt: number;
	key: string;
	storage: SharedStorage;
};

function parseJsonLines<T>(value: string): T[] {
	return value
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as T);
}

function parseStorageSize(value: string): number | null {
	const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
	if (!match) {
		return null;
	}
	const number = match[1];
	const unitName = match[2];
	if (number === undefined || unitName === undefined) {
		return null;
	}
	const unit = STORAGE_UNITS[unitName];
	return unit === undefined ? null : Math.round(Number(number) * unit);
}

function parseVolumeUsage(
	value: string,
	volumes: string[],
): Record<string, number | null> {
	const usage: Record<string, number | null> = Object.fromEntries(
		volumes.map((volume) => [volume, null]),
	);
	const lines = value.split("\n");
	const sectionStart = lines.findIndex(
		(line) => line.trim() === "Local Volumes space usage:",
	);
	if (sectionStart === -1) {
		return usage;
	}
	for (const line of lines.slice(sectionStart + 2)) {
		const match = line.match(/^(\S+)\s+\d+\s+(.+)$/);
		const name = match?.[1];
		const size = match?.[2];
		if (name && size && name in usage) {
			usage[name] = parseStorageSize(size);
		}
	}
	return usage;
}

/** Docker and Compose observation through their installed CLIs. */
export class DockerObserver {
	private storageUsageCache: StorageUsageCache | null = null;

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
					"--all",
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
			const ready = CORE_SERVICES.every((service) => {
				const container = containers.find(
					(candidate) => candidate.Service === service,
				);
				return (
					container?.State === "running" &&
					(!container.Health || container.Health === "healthy")
				);
			});
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
		env?: NodeJS.ProcessEnv,
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
				{ cwd, env },
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
			const volumePrefix = env?.VT_DEV_REPOSITORY_ID
				? `virtool-dev-${env.VT_DEV_REPOSITORY_ID}`
				: project;
			const volumeNames = {
				azurite: `${volumePrefix}-azurite`,
				postgres: `${volumePrefix}-postgres`,
			};
			const storageKey = Object.values(volumeNames).join("\0");
			const now = Date.now();
			let storage = this.storageUsageCache?.storage ?? {
				azurite: null,
				postgres: null,
			};
			if (
				!this.storageUsageCache ||
				this.storageUsageCache.key !== storageKey ||
				now - this.storageUsageCache.checkedAt >= STORAGE_USAGE_INTERVAL_MS
			) {
				try {
					const result = await this.run("docker", [
						"system",
						"df",
						"--verbose",
					]);
					const usage = parseVolumeUsage(
						result.stdout,
						Object.values(volumeNames),
					);
					storage = {
						azurite: usage[volumeNames.azurite] ?? null,
						postgres: usage[volumeNames.postgres] ?? null,
					};
				} catch {
					// Health state remains useful when Docker cannot report volume usage.
				}
				this.storageUsageCache = { checkedAt: now, key: storageKey, storage };
			}
			return {
				initialized: Object.keys(services).length > 0,
				lastError: null,
				services,
				storage,
			};
		} catch (error) {
			return {
				initialized: false,
				lastError: error instanceof Error ? error.message : String(error),
				services: {},
				storage: { azurite: null, postgres: null },
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
