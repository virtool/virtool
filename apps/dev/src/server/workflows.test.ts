import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger } from "@virtool/logger";
import { afterEach, expect, it, vi } from "vitest";
import type { Environment } from "../shared/types.ts";
import { BuildCoordinator } from "./builds.ts";
import type { CommandRunner } from "./command.ts";
import { StateStore } from "./state.ts";
import { WorkflowCoordinator } from "./workflows.ts";

const stores: StateStore[] = [];

afterEach(() => {
	for (const store of stores.splice(0)) {
		store.close();
	}
});

function createCoordinator(run: CommandRunner, publish = vi.fn()) {
	const store = new StateStore(mkdtempSync(join(tmpdir(), "virtool-dev-")));
	stores.push(store);
	store.setWorkflowConcurrency(2);
	return new WorkflowCoordinator(
		store,
		run,
		"/repo",
		publish,
		new BuildCoordinator(),
		createLogger({ level: "silent", name: "test" }),
	);
}

function createEnvironment(id: string): Environment {
	return {
		age: 1,
		branch: id,
		desired: "up",
		id,
		lastError: null,
		name: id,
		observed: "running",
		openPullRequest: null,
		operation: null,
		path: `/repo/${id}`,
		ready: true,
		services: {},
		url: null,
		workflowEnabled: true,
		worktreeId: id,
	};
}

function isCountRead(args: string[], environmentId: string) {
	return args.some((arg) => arg.endsWith(`-${environmentId}-jobs-api-1`));
}

function isLaunch(args: string[], environmentId: string) {
	return (
		args.includes("run") &&
		args.some((arg) => arg.endsWith(`-${environmentId}`))
	);
}

it("records and publishes scheduler failures", async () => {
	const run = vi
		.fn<CommandRunner>()
		.mockRejectedValue(new Error("Docker is unavailable"));
	const publish = vi.fn();
	const workflows = createCoordinator(run, publish);

	await workflows.tick([]);

	expect(workflows.getState().lastError).toBe("Docker is unavailable");
	expect(publish).toHaveBeenCalledOnce();
});

it("keeps scheduling healthy environments when one count read fails", async () => {
	const run = vi.fn<CommandRunner>(async (_command, args) => {
		if (isCountRead(args, "broken")) {
			throw new Error("connect ECONNREFUSED 127.0.0.1:9950");
		}
		if (isCountRead(args, "healthy")) {
			return { stderr: "", stdout: '{"pending":{"nuvs":1}}\n' };
		}
		return { stderr: "", stdout: "" };
	});
	const workflows = createCoordinator(run);

	await workflows.tick([
		createEnvironment("broken"),
		createEnvironment("healthy"),
	]);

	const state = workflows.getState();
	expect(state.lastError).toBeNull();
	expect(state.errors).toEqual({
		broken: "connect ECONNREFUSED 127.0.0.1:9950",
	});
	expect(state.queues).toEqual({ healthy: { nuvs: 1 } });
	expect(state.active).toEqual([
		{ environmentId: "healthy", workflow: "nuvs" },
	]);
});

it("keeps launching other candidates when one launch fails", async () => {
	const run = vi.fn<CommandRunner>(async (_command, args) => {
		if (args.includes("exec")) {
			return { stderr: "", stdout: '{"pending":{"pathoscope":1}}\n' };
		}
		if (isLaunch(args, "broken")) {
			throw new Error("Build failed");
		}
		return { stderr: "", stdout: "" };
	});
	const workflows = createCoordinator(run);

	await workflows.tick([
		createEnvironment("broken"),
		createEnvironment("healthy"),
	]);

	const state = workflows.getState();
	expect(state.lastError).toBeNull();
	expect(state.errors).toEqual({ broken: "Build failed" });
	expect(state.buildQueue).toEqual([]);
	expect(state.active).toEqual([
		{ environmentId: "healthy", workflow: "pathoscope" },
	]);
});

it("clears an environment error after a successful tick", async () => {
	let broken = true;
	const run = vi.fn<CommandRunner>(async (_command, args) => {
		if (args.includes("exec")) {
			if (broken) {
				throw new Error("Jobs API unavailable");
			}
			return { stderr: "", stdout: '{"pending":{}}\n' };
		}
		return { stderr: "", stdout: "" };
	});
	const workflows = createCoordinator(run);
	const environments = [createEnvironment("flaky")];

	await workflows.tick(environments);
	expect(workflows.getState().errors).toEqual({
		flaky: "Jobs API unavailable",
	});

	broken = false;
	await workflows.tick(environments);
	expect(workflows.getState().errors).toEqual({});
});
