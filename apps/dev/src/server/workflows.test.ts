import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger } from "@virtool/logger";
import { expect, it, vi } from "vitest";
import { BuildCoordinator } from "./builds.ts";
import type { CommandRunner } from "./command.ts";
import { StateStore } from "./state.ts";
import { WorkflowCoordinator } from "./workflows.ts";

it("records and publishes scheduler failures", async () => {
	const store = new StateStore(mkdtempSync(join(tmpdir(), "virtool-dev-")));
	const run = vi
		.fn<CommandRunner>()
		.mockRejectedValue(new Error("Docker is unavailable"));
	const publish = vi.fn();
	const workflows = new WorkflowCoordinator(
		store,
		run,
		"/repo",
		publish,
		new BuildCoordinator(),
		createLogger({ level: "silent", name: "test" }),
	);

	await workflows.tick([]);

	expect(workflows.getState().lastError).toBe("Docker is unavailable");
	expect(publish).toHaveBeenCalledOnce();
	store.close();
});
