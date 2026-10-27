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

	it("marks unfinished operations as interrupted after a daemon stop", () => {
		const store = createStore();
		store.synchronizeWorktrees([{ branch: "main", id: "wt-1", path: "/one" }]);
		const environmentId = store.setDesired("wt-1", "up");
		const operationId = store.startOperation(environmentId, "start");
		store.updateOperation(operationId, "running", "starting services");

		store.interruptActiveOperations();

		expect(store.hasActiveOperations()).toBe(false);
		expect(store.listEnvironments(new Map())[0]?.operation).toMatchObject({
			error: "Daemon stopped before the operation completed",
			progress: "interrupted",
			status: "failed",
		});
	});

	it("retains the active step when an operation fails", () => {
		const store = createStore();
		store.synchronizeWorktrees([{ branch: "main", id: "wt-1", path: "/one" }]);
		const environmentId = store.setDesired("wt-1", "up");
		const operationId = store.startOperation(environmentId, "start");
		store.updateOperation(operationId, "running", "running migrations");

		store.failOperation(operationId, "Migration failed");

		expect(store.listEnvironments(new Map())[0]?.operation).toMatchObject({
			error: "Migration failed",
			finishedAt: expect.any(Number),
			progress: "running migrations",
			status: "failed",
		});
	});
});

describe("create default administrator flag", () => {
	it("is true by default", () => {
		const store = createStore();
		store.synchronizeWorktrees([
			{ branch: "main", id: "wt-1", path: "/one" },
			{ branch: "other", id: "wt-2", path: "/two" },
		]);
		store.setDesired("wt-1", "up");

		expect(store.getDesiredEnvironments()[0]?.createDefaultAdministrator).toBe(
			true,
		);
		expect(
			store
				.listEnvironments(new Map())
				.map((environment) => environment.createDefaultAdministrator),
		).toEqual([true, true]);
	});

	it("keeps the value from creation on later changes", () => {
		const store = createStore();
		store.synchronizeWorktrees([{ branch: "main", id: "wt-1", path: "/one" }]);
		store.setDesired("wt-1", "up", false);
		store.setDesired("wt-1", "stopped");
		store.setDesired("wt-1", "up", true);

		expect(store.getDesiredEnvironments()[0]?.createDefaultAdministrator).toBe(
			false,
		);
		expect(
			store.listEnvironments(new Map())[0]?.createDefaultAdministrator,
		).toBe(false);
	});

	it("is true for environments from before the flag existed", () => {
		const directory = mkdtempSync(join(tmpdir(), "virtool-dev-"));
		const before = new StateStore(directory);
		before.synchronizeWorktrees([{ branch: "main", id: "wt-1", path: "/one" }]);
		before.setDesired("wt-1", "up", false);
		before.database.exec(
			"ALTER TABLE environments DROP COLUMN create_default_administrator",
		);
		before.close();

		const store = new StateStore(directory);
		stores.push(store);

		expect(store.getDesiredEnvironments()[0]?.createDefaultAdministrator).toBe(
			true,
		);
	});
});

it("creates safe readable slugs", () => {
	expect(slugify("refs/heads/Feature/My change!")).toBe("feature-my-change");
});

describe("default administrator", () => {
	it("keeps the saved password when a new one is empty", () => {
		const store = createStore();
		store.setDefaultAdministrator({
			email: "admin@example.com",
			handle: "admin",
			password: "hello world",
		});
		store.setDefaultAdministrator({
			email: " new@example.com ",
			handle: "boss",
			password: "",
		});

		expect(store.getDefaultAdministrator()).toEqual({
			email: "new@example.com",
			handle: "boss",
		});
		expect(store.getDefaultAdministratorCredentials()?.password).toBe(
			"hello world",
		);
	});

	it("requires a password when none is saved", () => {
		const store = createStore();

		expect(() =>
			store.setDefaultAdministrator({
				email: "admin@example.com",
				handle: "admin",
				password: "",
			}),
		).toThrow("Handle, email, and password are required");
		expect(store.getDefaultAdministrator()).toBeNull();
	});

	it.each([
		["ad", "admin@example.com", "hello world", "User name must have 3 to 30"],
		["virtool", "admin@example.com", "hello world", "Reserved user name"],
		["admin", "admin", "hello world", "Enter a valid email address."],
		["admin", "admin@example.com", "short", "minimum length requirement (8)"],
	])(
		"rejects handle %j, email %j, and password %j",
		(handle, email, password, message) => {
			const store = createStore();

			expect(() =>
				store.setDefaultAdministrator({ email, handle, password }),
			).toThrow(message);
			expect(store.getDefaultAdministrator()).toBeNull();
		},
	);

	it("checks the saved password against the rules", () => {
		const store = createStore();
		store.setDefaultAdministrator({
			email: "admin@example.com",
			handle: "admin",
			password: "hello world",
		});

		expect(() =>
			store.setDefaultAdministrator({
				email: "admin@example.com",
				handle: "virtool",
				password: "",
			}),
		).toThrow("Reserved user name: virtool");
		expect(store.getDefaultAdministrator()?.handle).toBe("admin");
	});

	it("clears every saved value", () => {
		const store = createStore();
		store.setDefaultAdministrator({
			email: "admin@example.com",
			handle: "admin",
			password: "hello world",
		});

		store.clearDefaultAdministrator();

		expect(store.getDefaultAdministratorCredentials()).toBeNull();
	});
});
