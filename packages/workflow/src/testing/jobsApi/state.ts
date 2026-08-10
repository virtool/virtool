/**
 * The one mutable object both halves of the jobs API harness read and write.
 *
 * Mirrors Python's `WorkflowData`. The faked client and the embedded server
 * share it, so a test can be moved from one to the other without rewriting its
 * setup — the property that made the Python fixture usable at all.
 */

import type {
	Cache,
	FinalizeAnalysisRequest,
	FinalizeSampleRequest,
	FinalizeSubtractionRequest,
	Job,
	RegisterCacheRequest,
	WorkflowAnalysis,
	WorkflowIndex,
	WorkflowReference,
	WorkflowSample,
	WorkflowSettings,
	WorkflowSubtraction,
} from "@virtool/contracts";
import { createFakeJob, createFakeSettings, staticTime } from "../builders";
import { createSeededRandom, DEFAULT_SEED } from "../random";

/** A finalize call a workflow made, recorded for assertion. */
export type FinalizeCall =
	| { resource: "sample"; id: number; request: FinalizeSampleRequest }
	| { resource: "subtraction"; id: number; request: FinalizeSubtractionRequest }
	| { resource: "analysis"; id: number; request: FinalizeAnalysisRequest };

/** Everything the jobs API harness knows and everything it records. */
export type JobsApiState = {
	/** The one job this fixture serves. Flip `state` to drive cancellation. */
	job: Job;

	/** The runner key `POST /jobs/claim` hands out and every call authenticates with. */
	key: string;

	/** Whether the job has been claimed. A second claim is answered 404. */
	acquired: boolean;

	/**
	 * When the job was last pinged, or `null` if it never was.
	 *
	 * Fixture bookkeeping rather than part of the job: `pinged_at` is a column
	 * the jobs API writes and no read shape publishes, so a test asserts the
	 * heartbeat here.
	 */
	pingedAt: Date | null;

	/** Step ids `POST /jobs/{id}/steps/{stepId}/start` was called for, in order. */
	stepStartUpdates: string[];

	/** Whether `POST /jobs/{id}/finish` succeeded. */
	finishCalled: boolean;

	/** Every finalize call, with the manifest it carried. */
	finalizeCalls: FinalizeCall[];

	/** Every `POST /caches` body, including ones that lost a race to an existing row. */
	cacheRegistrations: RegisterCacheRequest[];

	/** Cache rows, by logical cache key. */
	caches: Map<string, Cache>;

	analyses: Map<number, WorkflowAnalysis>;
	indexes: Map<number, WorkflowIndex>;
	references: Map<number, WorkflowReference>;
	samples: Map<number, WorkflowSample>;
	subtractions: Map<number, WorkflowSubtraction>;

	settings: WorkflowSettings;

	/**
	 * The clock the routes stamp with.
	 *
	 * Injected rather than patched. Defaults to {@link staticTime}, so a step
	 * start and a ping are reproducible; a test that needs two distinct instants
	 * supplies its own.
	 */
	now: () => Date;
};

/** What {@link createJobsApiState} accepts. Every field has a seeded default. */
export type CreateJobsApiStateOptions = Partial<JobsApiState> & {
	seed?: number;
};

/**
 * Build the shared state.
 *
 * Nothing is installed and nothing is global: a test that wants two independent
 * fixtures calls this twice.
 */
export function createJobsApiState({
	seed = DEFAULT_SEED,
	...overrides
}: CreateJobsApiStateOptions = {}): JobsApiState {
	const random = createSeededRandom(seed);

	return {
		// Unclaimed, so a test that exercises the claim starts where a real pod
		// does. `POST /jobs/claim` is what moves it to `running`.
		job: createFakeJob(
			{ claim: null, claimedAt: null, state: "pending" },
			seed,
		),
		key: random.hex(32),
		acquired: false,
		pingedAt: null,
		stepStartUpdates: [],
		finishCalled: false,
		finalizeCalls: [],
		cacheRegistrations: [],
		caches: new Map(),
		analyses: new Map(),
		indexes: new Map(),
		references: new Map(),
		samples: new Map(),
		subtractions: new Map(),
		settings: createFakeSettings(),
		now: staticTime,
		...overrides,
	};
}
