import type {
	Environment,
	ServiceState,
	SharedState,
	SharedStorage,
} from "../shared/types.ts";
import type { CommandRunner } from "./command.ts";
import { validateOwnership } from "./ownership.ts";

type Container = {
	oneoff: boolean;
	project: string;
	service: string;
	state: string;
	status: string;
};

/** Observed state of one environment's Compose services. */
export type EnvironmentObservation = {
	ready: boolean;
	services: Record<string, ServiceState>;
	state: Environment["observed"];
};

/** Environments, keyed by Compose project, and shared services for one repository. */
export type RepositoryObservation = {
	environments: Map<string, EnvironmentObservation>;
	error: string | null;
	shared: SharedState;
};

const CONTAINER_FORMAT = [
	'{{.Label "com.docker.compose.project"}}',
	'{{.Label "com.docker.compose.service"}}',
	'{{.Label "com.docker.compose.oneoff"}}',
	"{{.State}}",
	"{{.Status}}",
].join("\t");

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

function parseContainers(value: string): Container[] {
	return value
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [project = "", service = "", oneoff = "", state = "", status = ""] =
				line.split("\t");
			return {
				oneoff: oneoff === "True",
				project,
				service,
				state,
				status,
			};
		})
		.filter((container) => !container.oneoff && container.service);
}

function getServiceState(container: Container): ServiceState {
	if (container.state !== "running") {
		return "stopped";
	}
	const health = container.status.match(
		/\((healthy|unhealthy|health: starting)\)$/,
	)?.[1];
	return health && health !== "healthy" ? "unhealthy" : "healthy";
}

function summarizeEnvironment(containers: Container[]): EnvironmentObservation {
	if (containers.length === 0) {
		return { ready: false, services: {}, state: "stopped" };
	}
	const services: Record<string, ServiceState> = {};
	for (const container of containers) {
		services[container.service] = getServiceState(container);
	}
	return {
		ready: CORE_SERVICES.every((service) => services[service] === "healthy"),
		services,
		state: containers.every((container) => container.state === "running")
			? "running"
			: "stopped",
	};
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

	/** Observe every container labelled for a repository with one Docker call. */
	async observeRepository(
		repositoryId: string,
		sharedProject: string,
		includeStorage: boolean,
	): Promise<RepositoryObservation> {
		let containers: Container[];
		try {
			containers = await this.listContainers(
				`label=ca.virtool.dev.repository=${repositoryId}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				environments: new Map(),
				error: message,
				shared: {
					initialized: false,
					lastError: message,
					services: {},
					storage: { azurite: null, postgres: null },
				},
			};
		}
		const byProject = new Map<string, Container[]>();
		for (const container of containers) {
			byProject.set(container.project, [
				...(byProject.get(container.project) ?? []),
				container,
			]);
		}
		const environments = new Map<string, EnvironmentObservation>();
		for (const [project, projectContainers] of byProject) {
			if (project !== sharedProject) {
				environments.set(project, summarizeEnvironment(projectContainers));
			}
		}
		const services: SharedState["services"] = {};
		for (const container of byProject.get(sharedProject) ?? []) {
			if (container.state === "running") {
				services[container.service] = getServiceState(container);
			}
		}
		return {
			environments,
			error: null,
			shared: {
				initialized: Object.keys(services).length > 0,
				lastError: null,
				services,
				storage: await this.getStorage(repositoryId, includeStorage),
			},
		};
	}

	async inspectEnvironment(project: string): Promise<EnvironmentObservation> {
		try {
			return summarizeEnvironment(
				await this.listContainers(
					`label=com.docker.compose.project=${project}`,
				),
			);
		} catch {
			return { ready: false, services: {}, state: "missing" };
		}
	}

	private async listContainers(filter: string): Promise<Container[]> {
		const { stdout } = await this.run("docker", [
			"ps",
			"--all",
			"--filter",
			filter,
			"--format",
			CONTAINER_FORMAT,
		]);
		return parseContainers(stdout);
	}

	private async getStorage(
		repositoryId: string,
		refresh: boolean,
	): Promise<SharedStorage> {
		const volumeNames = {
			azurite: `virtool-dev-${repositoryId}-azurite`,
			postgres: `virtool-dev-${repositoryId}-postgres`,
		};
		const storageKey = Object.values(volumeNames).join("\0");
		const cached =
			this.storageUsageCache?.key === storageKey
				? this.storageUsageCache
				: null;
		const now = Date.now();
		if (
			!refresh ||
			(cached && now - cached.checkedAt < STORAGE_USAGE_INTERVAL_MS)
		) {
			return cached?.storage ?? { azurite: null, postgres: null };
		}
		let storage = cached?.storage ?? { azurite: null, postgres: null };
		try {
			const result = await this.run("docker", ["system", "df", "--verbose"]);
			const usage = parseVolumeUsage(result.stdout, Object.values(volumeNames));
			storage = {
				azurite: usage[volumeNames.azurite] ?? null,
				postgres: usage[volumeNames.postgres] ?? null,
			};
		} catch {
			// Health state remains useful when Docker cannot report volume usage.
		}
		this.storageUsageCache = { checkedAt: now, key: storageKey, storage };
		return storage;
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
