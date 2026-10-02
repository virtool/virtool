import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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

it("gives each default administrator value as one argument", async () => {
	const store = new StateStore(
		mkdtempSync(join(tmpdir(), "virtool-dev-lifecycle-")),
	);
	stores.push(store);
	const worktree = join(import.meta.dirname, "../../../..");
	store.synchronizeWorktrees([{ branch: "main", id: "wt-1", path: worktree }]);
	store.setDesired("wt-1", "up");
	store.setDefaultAdministrator({
		email: "admin@example.com",
		handle: "admin",
		password: "-secret123",
	});
	const run = vi.fn<CommandRunner>(async (_command, args) => ({
		stderr: "",
		stdout: args.includes("--services") ? "web\ndev-tools\n" : "",
	}));
	const reconciler = new Reconciler(
		store,
		run,
		worktree,
		vi.fn(),
		new BuildCoordinator(),
	);

	reconciler.start();
	await reconciler.stop();

	const [, args, options] =
		run.mock.calls.find(([, args]) => args.includes("administrator")) ?? [];
	expect(args?.slice(args.indexOf("--env"))).toEqual([
		"--env",
		"VT_ADMINISTRATOR_PASSWORD",
		"dev-tools",
		"create",
		"administrator",
		"--handle=admin",
		"--email=admin@example.com",
	]);
	expect(args?.join(" ")).not.toContain("secret123");
	expect(options?.env?.VT_ADMINISTRATOR_PASSWORD).toBe("-secret123");
});

describe("default administrator step", () => {
	function startEnvironment(createDefaultAdministrator?: boolean) {
		const store = new StateStore(
			mkdtempSync(join(tmpdir(), "virtool-dev-lifecycle-")),
		);
		stores.push(store);
		const worktree = join(import.meta.dirname, "../../../..");
		store.synchronizeWorktrees([
			{ branch: "main", id: "wt-1", path: worktree },
		]);
		store.setDefaultAdministrator({
			email: "admin@example.com",
			handle: "admin",
			password: "hello world",
		});
		store.setDesired("wt-1", "up", createDefaultAdministrator);
		const run = vi.fn<CommandRunner>(async (_command, args) => ({
			stderr: "",
			stdout: args.includes("--services") ? "web\ndev-tools\n" : "",
		}));
		return { run, store, worktree };
	}

	async function reconcile(
		store: StateStore,
		run: CommandRunner,
		worktree: string,
	): Promise<void> {
		const reconciler = new Reconciler(
			store,
			run,
			worktree,
			vi.fn(),
			new BuildCoordinator(),
		);
		reconciler.start();
		await reconciler.stop();
	}

	function getDevToolsCalls(run: ReturnType<typeof startEnvironment>["run"]) {
		return run.mock.calls
			.map(([, args]) => args)
			.filter((args) => args.includes("dev-tools"));
	}

	it("runs when the environment uses the default", async () => {
		const { run, store, worktree } = startEnvironment();

		await reconcile(store, run, worktree);

		expect(
			getDevToolsCalls(run).some((args) => args.includes("administrator")),
		).toBe(true);
	});

	it("skips the step and the service on every start when the flag is false", async () => {
		const { run, store, worktree } = startEnvironment(false);

		await reconcile(store, run, worktree);
		store.setDesired("wt-1", "stopped");
		store.setDesired("wt-1", "up");
		await reconcile(store, run, worktree);

		expect(
			run.mock.calls.filter(([, args]) => args.at(-1) === "migration"),
		).toHaveLength(2);
		expect(getDevToolsCalls(run)).toEqual([]);
		expect(run.mock.calls.some(([, args]) => args.includes("--services"))).toBe(
			false,
		);
	});
});
