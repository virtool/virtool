import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StateStore, slugify } from "./state.ts";

const stores: StateStore[] = [];

afterEach(() => {
	for (const store of stores.splice(0)) {
		store.close();
	}
});

function createStore(): StateStore {
	const store = new StateStore(mkdtempSync(join(tmpdir(), "virtool-dev-")));
	stores.push(store);
	return store;
}

describe("StateStore", () => {
	it("keeps identity and hostname stable across branch and path changes", () => {
		const store = createStore();
		store.synchronizeWorktrees([
			{ id: "wt-1", path: "/one", branch: "Feature/One" },
		]);
		const id = store.setDesired("wt-1", "up");
		const before = store.listEnvironments(new Map())[0];

		store.synchronizeWorktrees([
			{ id: "wt-1", path: "/moved", branch: "Feature/Renamed" },
		]);
		const after = store.listEnvironments(new Map())[0];

		expect(after?.id).toBe(id);
		expect(after?.url).toBe(before?.url);
		expect(after?.branch).toBe("Feature/Renamed");
		expect(after?.path).toBe("/moved");
	});

	it("lets remove supersede start", () => {
		const store = createStore();
		store.synchronizeWorktrees([{ id: "wt-1", path: "/one", branch: "main" }]);
		store.setDesired("wt-1", "up");
		store.setDesired("wt-1", "absent");
		expect(store.getDesiredEnvironments()[0]?.desired).toBe("absent");
	});

	it("retries without changing the desired state", () => {
		const store = createStore();
		store.synchronizeWorktrees([{ id: "wt-1", path: "/one", branch: "main" }]);
		const environmentId = store.setDesired("wt-1", "absent");
		store.setEnvironmentError(environmentId, "cleanup failed");

		expect(store.retryEnvironment("wt-1")).toBe(environmentId);
		expect(store.getDesiredEnvironments()[0]).toMatchObject({
			desired: "absent",
			lastError: null,
		});
	});
});

it("creates safe readable slugs", () => {
	expect(slugify("refs/heads/Feature/My change!")).toBe("feature-my-change");
});
