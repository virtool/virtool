/**
 * Context builders.
 *
 * Composition is explicit: a test that wants a seeded context over a faked jobs
 * API calls both factories and wires them, rather than declaring parameter names
 * and hoping a plugin resolves them. pytest injected fixtures by name and
 * resolved a dependency graph between them; Vitest has no equivalent and this
 * harness deliberately does not build one.
 */

import { MemoryStorage } from "@virtool/storage";
import type { JobsApiClient } from "../client/client";
import {
	type BuildContextInput,
	createWorkflowContext,
	type RunJob,
	type WorkflowContext,
} from "../context";
import type { Workflow } from "../step";
import { createRecordingLogger } from "./logger";
import { createFakeSubprocessRunner } from "./subprocess";

/** A claimed job standing in for whatever the jobs API handed back. */
export function createFakeRunJob(overrides: Partial<RunJob> = {}): RunJob {
	return { id: 1, workflow: "create_subtraction", args: {}, ...overrides };
}

/**
 * A jobs API client that refuses every call.
 *
 * A context needs one to typecheck, and a test that did not set out to exercise
 * the lifecycle should fail loudly rather than silently reach the network.
 * `createFakeJobsApiClient` is the one that answers; use this when a call would
 * mean the code under test did something it should not have.
 */
export function createUnreachableJobsApiClient(
	overrides: Partial<JobsApiClient> = {},
): JobsApiClient {
	const refuse = (name: string) => () =>
		Promise.reject(new Error(`jobs API client ${name} was called in a test`));

	return {
		request: refuse("request"),
		getJob: refuse("getJob"),
		ping: refuse("ping"),
		startStep: refuse("startStep"),
		finish: refuse("finish"),
		close: () => Promise.resolve(),
		...overrides,
	};
}

/** The input a per-workflow `buildContext` is handed. */
export function createFakeBuildContextInput(
	overrides: Partial<BuildContextInput> = {},
): BuildContextInput {
	return {
		job: createFakeRunJob(),
		workPath: "/tmp/workflow-test",
		proc: 2,
		mem: 4,
		logger: createRecordingLogger().logger,
		signal: new AbortController().signal,
		client: createUnreachableJobsApiClient(),
		runSubprocess: createFakeSubprocessRunner(),
		// An empty bucket rather than a refusing one: storage is faked at the
		// backend, so a test that reads a key it never seeded gets the
		// `StorageKeyNotFoundError` production would give it. Pass the
		// `createTestStorage()` backend to seed.
		storage: new MemoryStorage(),
		...overrides,
	};
}

/** A context for a workflow whose data and state a test supplies directly. */
export function createFakeContext<TData, TState>(
	data: TData,
	state: TState,
	overrides: Partial<BuildContextInput> = {},
): WorkflowContext<TData, TState> {
	return { ...createFakeBuildContextInput(overrides), data, state };
}

/**
 * Build a real context by running a workflow's own `buildContext`.
 *
 * Goes through `createWorkflowContext`, so `assertSerializableData` runs. That
 * seam is what the deferred end-to-end bed depends on — a run there is files
 * plus a JSON blob — and it rots silently the first time someone parks a closure
 * or an open handle on `data`. A test asserting only on the values would not
 * notice; this one cannot avoid it.
 */
export function buildTestContext<TData, TState>(
	workflow: Workflow<TData, TState>,
	overrides: Partial<BuildContextInput> = {},
): Promise<WorkflowContext<TData, TState>> {
	return createWorkflowContext(
		workflow,
		createFakeBuildContextInput(overrides),
	);
}
