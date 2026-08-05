import type { JobWorkflow, JsonObject } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { JobsApiClient } from "./client/client";
import { assertSerializableData } from "./serializable";
import type { Workflow } from "./step";
import type { RunSubprocess } from "./subprocess/types";

/** The claimed job, as steps see it. */
export type RunJob = {
	id: number;
	workflow: JobWorkflow;
	args: JsonObject;
};

/** What a per-workflow context builder is handed. */
export type BuildContextInput = {
	job: RunJob;
	workPath: string;
	proc: number;
	mem: number;
	logger: Logger;
	signal: AbortSignal;
	/**
	 * The run's authenticated jobs API client, already built by the time
	 * `buildContext` runs so a metadata read needs no second construction path.
	 */
	client: JobsApiClient;
	runSubprocess: RunSubprocess;
};

/**
 * Builds the serializable data half of a run's context.
 *
 * One of these per workflow, and it is the *only* producer of `data`. Python
 * resolved fixtures lazily by introspecting a step's parameter names against a
 * registry; this is eager and plain, so a storage read that fails surfaces
 * before step 1 rather than forty minutes in.
 */
export type BuildContext<TData> = (input: BuildContextInput) => Promise<TData>;

/** Everything a workflow step receives. */
export type WorkflowContext<TData, TState> = {
	/**
	 * Eagerly built, serializable domain data. The only member `buildContext`
	 * produces.
	 */
	readonly data: TData;
	/** Mutable cross-step scratch. Replaces Python's `results` dict. */
	state: TState;
	readonly job: RunJob;
	/** Absolute path to the emptied per-run work directory. */
	readonly workPath: string;
	readonly proc: number;
	readonly mem: number;
	readonly logger: Logger;
	/** Aborts on cancellation or SIGTERM. Forward it to anything long-running. */
	readonly signal: AbortSignal;
	/** The run's authenticated jobs API client. */
	readonly client: JobsApiClient;
	/**
	 * Runs a bioinformatics tool. Already bound to `signal`, so a step does not
	 * forward cancellation itself.
	 */
	readonly runSubprocess: RunSubprocess;

	// One more member lands here with its own issue: `storage`, for direct
	// object storage access. Only `data` is serializable-constrained; the live
	// handles are so by design.
};

/**
 * Build a run's context by calling the workflow's own `buildContext`.
 *
 * The seam exists so `assertSerializableData` cannot be skipped: a caller that
 * assembled the context itself would be free to forget it, and the failure it
 * catches is otherwise invisible until the end-to-end test bed is built.
 *
 * @throws {WorkflowError} when `buildContext` returns data that does not
 *   survive a JSON round trip.
 */
export async function createWorkflowContext<TData, TState>(
	workflow: Workflow<TData, TState>,
	input: BuildContextInput,
): Promise<WorkflowContext<TData, TState>> {
	const data = await workflow.buildContext(input);

	assertSerializableData(data);

	return { ...input, data, state: workflow.createState() };
}
