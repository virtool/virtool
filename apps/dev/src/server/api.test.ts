import { describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../shared/types.ts";
import { createApi, SnapshotFeed } from "./api.ts";

const snapshot: Snapshot = {
	environments: [],
	repositoryId: "repo",
	scheduler: {
		active: [],
		buildQueue: [],
		capacity: 1,
		concurrency: 1,
		lastError: null,
		queues: {},
	},
	shared: {
		initialized: false,
		lastError: null,
		services: {},
		storage: { azurite: null, postgres: null },
	},
	updatedAt: 1,
	updateAvailable: false,
};

describe("management API", () => {
	it("returns live state", async () => {
		const app = createApi(
			new SnapshotFeed(snapshot),
			vi.fn(),
			vi.fn(),
			"/missing",
		);
		const response = await app.request("http://127.0.0.1/api/state");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(snapshot);
	});

	it("rejects cross-origin mutations", async () => {
		const mutate = vi.fn();
		const app = createApi(
			new SnapshotFeed(snapshot),
			mutate,
			vi.fn(),
			"/missing",
		);
		const response = await app.request("http://127.0.0.1/api/environments", {
			body: JSON.stringify({ action: "stop", worktreeIds: [] }),
			headers: { origin: "https://evil.example" },
			method: "POST",
		});
		expect(response.status).toBe(403);
		expect(mutate).not.toHaveBeenCalled();
	});

	it("reads logs only for known environments and services", async () => {
		const readEnvironmentLogs = vi.fn(async () => "web | ready\n");
		const app = createApi(
			new SnapshotFeed({
				...snapshot,
				environments: [
					{
						age: 1,
						branch: "feature/logs",
						desired: "up",
						id: "environment-id",
						lastError: null,
						name: "feature-logs",
						observed: "running",
						openPullRequest: null,
						operation: null,
						path: "/repo/logs",
						ready: true,
						services: { web: "healthy" },
						url: "https://feature-logs.localhost:9443",
						workflowEnabled: true,
						worktreeId: "worktree-id",
					},
				],
			}),
			vi.fn(),
			vi.fn(),
			"/missing",
			undefined,
			undefined,
			readEnvironmentLogs,
		);
		const response = await app.request(
			"http://127.0.0.1/api/logs?environment=worktree-id&service=web",
		);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("web | ready\n");
		expect(readEnvironmentLogs).toHaveBeenCalledWith("environment-id", "web");

		const unknownService = await app.request(
			"http://127.0.0.1/api/logs?environment=worktree-id&service=unknown",
		);
		expect(unknownService.status).toBe(404);
		expect(readEnvironmentLogs).toHaveBeenCalledTimes(1);
	});

	it("reads daemon logs from the configured service", async () => {
		const readDaemonLogs = vi.fn(async () => "daemon ready\n");
		const app = createApi(
			new SnapshotFeed(snapshot),
			vi.fn(),
			vi.fn(),
			"/missing",
			undefined,
			readDaemonLogs,
		);

		const response = await app.request("http://127.0.0.1/api/logs");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("daemon ready\n");
		expect(readDaemonLogs).toHaveBeenCalledOnce();
	});
});
