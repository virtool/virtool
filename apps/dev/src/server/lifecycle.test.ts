import { mkdtempSync, rmSync } from "node:fs";
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
			.map((Service) =>
				JSON.stringify({ Health: "healthy", Service, State: "running" }),
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

	reconciler.wake();
	await reconciler.stop();

	expect(reconciler.hasActiveWork()).toBe(false);
	expect(publish).not.toHaveBeenCalled();
});
