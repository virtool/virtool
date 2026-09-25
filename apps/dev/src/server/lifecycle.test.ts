import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { BuildCoordinator } from "./builds.ts";
import type { CommandRunner } from "./command.ts";
import { Reconciler } from "./lifecycle.ts";
import { StateStore } from "./state.ts";

const stores: StateStore[] = [];

afterEach(() => {
	for (const store of stores.splice(0)) {
		store.close();
		rmSync(store.directory, { force: true, recursive: true });
	}
});

it("clears active work after reconciling an already-ready environment", async () => {
	const store = new StateStore(
		mkdtempSync(join(tmpdir(), "virtool-dev-lifecycle-")),
	);
	stores.push(store);
	store.synchronizeWorktrees([
		{
			branch: "main",
			id: "wt-1",
			path: join(import.meta.dirname, "../../../.."),
		},
	]);
	store.setDesired("wt-1", "up");
	const run = vi.fn<CommandRunner>().mockResolvedValue({
		stderr: "",
		stdout: ["jobs-api", "tasks", "web"]
			.map((service) =>
				["project", service, "False", "running", "Up (healthy)"].join("\t"),
			)
			.join("\n"),
	});
	const publish = vi.fn();
	const reconciler = new Reconciler(
		store,
		run,
		join(import.meta.dirname, "../../../.."),
		publish,
		new BuildCoordinator(),
	);

	reconciler.start();
	await reconciler.stop();

	expect(reconciler.hasActiveWork()).toBe(false);
	expect(publish).not.toHaveBeenCalled();
});

it("skips Docker calls for environments observed as converged", async () => {
	const store = new StateStore(
		mkdtempSync(join(tmpdir(), "virtool-dev-lifecycle-")),
	);
	stores.push(store);
	store.synchronizeWorktrees([
		{
			branch: "main",
			id: "wt-1",
			path: join(import.meta.dirname, "../../../.."),
		},
	]);
	const environmentId = store.setDesired("wt-1", "up");
	const project = `virtool-dev-${store.repositoryId.slice(0, 8)}-${environmentId.slice(0, 8)}`;
	const run = vi.fn<CommandRunner>().mockResolvedValue({
		stderr: "",
		stdout: ["jobs-api", "tasks", "web"]
			.map((service) =>
				[project, service, "False", "running", "Up (healthy)"].join("\t"),
			)
			.join("\n"),
	});
	const reconciler = new Reconciler(
		store,
		run,
		join(import.meta.dirname, "../../../.."),
		vi.fn(),
		new BuildCoordinator(),
	);
	await reconciler.observe(false);
	reconciler.start();
	await reconciler.stop();

	expect(run).toHaveBeenCalledOnce();
});

it("runs removal cleanup from the primary worktree's definitions", async () => {
	const store = new StateStore(
		mkdtempSync(join(tmpdir(), "virtool-dev-lifecycle-")),
	);
	stores.push(store);
	store.synchronizeWorktrees([
		{ branch: "feature", id: "wt-1", path: "/worktrees/feature" },
	]);
	const environmentId = store.setDesired("wt-1", "absent");
	const directory = join(store.directory, "environments", environmentId);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "compose.yaml"), "services: {}\n");
	const run = vi
		.fn<CommandRunner>()
		.mockResolvedValue({ stderr: "", stdout: "" });
	const primaryWorktree = "/worktrees/main";
	const reconciler = new Reconciler(
		store,
		run,
		primaryWorktree,
		vi.fn(),
		new BuildCoordinator(),
	);

	reconciler.start();
	await reconciler.stop();

	const cleanupFiles = run.mock.calls
		.map(([, args]) => args)
		.filter((args) => args.at(-1)?.startsWith("cleanup-"))
		.map((args) => args[args.indexOf("--file") + 1]);
	expect(cleanupFiles).toEqual([
		join(primaryWorktree, "dev/cleanup.compose.yaml"),
		join(primaryWorktree, "dev/cleanup.compose.yaml"),
	]);
	expect(store.getDesiredByEnvironment(environmentId)).toBeNull();
});
