import { createLogger, type Logger } from "@virtool/logger";
import type { JobsApiClient } from "./client/client";
import type { BuildContextInput, RunJob, WorkflowContext } from "./context";

/**
 * A logger that keeps its records instead of writing them.
 *
 * Test-only, and the only way to assert on the warnings the run loop and the
 * hook registry emit — both log and continue rather than throwing, so the
 * record is the whole observable effect.
 */
export type RecordingLogger = {
	logger: Logger;
	records: () => Array<Record<string, unknown>>;
};

export function createRecordingLogger(): RecordingLogger {
	const chunks: string[] = [];

	const logger = createLogger({
		name: "workflow-test",
		level: "debug",
		destination: {
			write(chunk: string) {
				chunks.push(chunk);
			},
		},
	});

	return {
		logger,
		records: () =>
			chunks
				.join("")
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as Record<string, unknown>),
	};
}

/** A claimed job standing in for whatever the jobs API handed back. */
export function createFakeRunJob(overrides: Partial<RunJob> = {}): RunJob {
	return { id: 1, workflow: "create_subtraction", args: {}, ...overrides };
}

/**
 * A jobs API client that refuses every call.
 *
 * A context needs one to typecheck, and a test that did not set out to exercise
 * the lifecycle should fail loudly rather than silently reach the network. The
 * fake the *workflow* test harness offers is a different thing and belongs to
 * its own issue; override individual methods here to stand in for it.
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
