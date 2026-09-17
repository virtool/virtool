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
	shared: { initialized: false, lastError: null, services: {} },
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
});
