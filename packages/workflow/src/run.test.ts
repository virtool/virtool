import { afterEach, describe, expect, it } from "vitest";
import {
	createRunSignals,
	type RunOutcome,
	type RunSignals,
	runWorkflow,
} from "./run";
import { defineWorkflow, type WorkflowStep } from "./step";
import { createFakeContext, createRecordingLogger } from "./testFixtures";

type Data = { referenceId: string };
type State = { visited: string[] };

type Deferred = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: Error) => void;
};

function deferred(): Deferred {
	let resolve = () => {};
	let reject = (_error: Error) => {};

	const promise = new Promise<void>((settle, fail) => {
		resolve = () => settle();
		reject = fail;
	});

	return { promise, resolve, reject };
}

/** A step that records that it ran. */
function visitStep(id: string): WorkflowStep<Data, State> {
	return {
		id,
		description: `Run ${id}.`,
		run: async (context) => {
			context.state.visited.push(id);
		},
	};
}

/** A step that throws. */
function throwingStep(id: string, error: unknown): WorkflowStep<Data, State> {
	return {
		id,
		description: `Run ${id}.`,
		run: async () => {
			throw error;
		},
	};
}

type Harness = {
	context: ReturnType<typeof createFakeContext<Data, State>>;
	/** Every step id passed to `onStepStart`, in order. */
	started: string[];
	records: () => Array<Record<string, unknown>>;
	logged: (message: string) => boolean;
	run: () => Promise<RunOutcome>;
};

/**
 * Build a run over `steps`, driven by `signals`.
 *
 * The signals are taken rather than created here because the context has to
 * carry the same `AbortSignal` the run loop races against, the way
 * `createWorkflowContext` wires it in production. A context holding a second,
 * unrelated signal would hide every bug in how a step reacts to its own
 * cancellation.
 */
function setup(
	signals: RunSignals,
	steps: WorkflowStep<Data, State>[],
	onStepStart?: (step: { id: string }) => Promise<void>,
): Harness {
	const recording = createRecordingLogger();
	const started: string[] = [];

	const workflow = defineWorkflow<Data, State>({
		name: "pathoscope",
		buildContext: async () => ({ referenceId: "ref" }),
		createState: () => ({ visited: [] }),
		steps,
	});

	const context = createFakeContext<Data, State>(
		{ referenceId: "ref" },
		{ visited: [] },
		{ signal: signals.signal },
	);

	return {
		context,
		started,
		records: recording.records,
		logged: (message) =>
			recording.records().some((record) => record.msg === message),
		run: () =>
			runWorkflow({
				workflow,
				context,
				signals,
				logger: recording.logger,
				onStepStart: async (step) => {
					started.push(step.id);
					await onStepStart?.(step);
				},
			}),
	};
}

describe("createRunSignals", () => {
	it("reports neither flag before anything happens", () => {
		const signals = createRunSignals();

		expect(signals.signal.aborted).toBe(false);
		expect(signals.isCancelled()).toBe(false);
		expect(signals.isTerminated()).toBe(false);
	});

	it("aborts and flags cancellation", () => {
		const signals = createRunSignals();

		signals.cancel();

		expect(signals.signal.aborted).toBe(true);
		expect(signals.isCancelled()).toBe(true);
		expect(signals.isTerminated()).toBe(false);
	});

	it("aborts and flags termination", () => {
		const signals = createRunSignals();

		signals.terminate();

		expect(signals.signal.aborted).toBe(true);
		expect(signals.isTerminated()).toBe(true);
		expect(signals.isCancelled()).toBe(false);
	});
});

describe("runWorkflow", () => {
	it("runs every step in order and succeeds", async () => {
		const harness = setup(createRunSignals(), [
			visitStep("first"),
			visitStep("second"),
		]);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "succeeded" });
		expect(harness.context.state.visited).toEqual(["first", "second"]);
		expect(harness.started).toEqual(["first", "second"]);
	});

	it("runs without an onStepStart callback", async () => {
		const signals = createRunSignals();
		const recording = createRecordingLogger();
		const context = createFakeContext<Data, State>(
			{ referenceId: "ref" },
			{ visited: [] },
			{ signal: signals.signal },
		);

		const outcome = await runWorkflow({
			workflow: defineWorkflow<Data, State>({
				name: "pathoscope",
				buildContext: async () => ({ referenceId: "ref" }),
				createState: () => ({ visited: [] }),
				steps: [visitStep("first")],
			}),
			context,
			signals,
			logger: recording.logger,
		});

		expect(outcome).toEqual({ state: "succeeded" });
		expect(context.state.visited).toEqual(["first"]);
	});

	it("logs each step it runs", async () => {
		const harness = setup(createRunSignals(), [visitStep("map_reads")]);

		await harness.run();

		const record = harness
			.records()
			.find((entry) => entry.msg === "running workflow step");

		expect(record?.stepId).toBe("map_reads");
		expect(record?.name).toBe("Map Reads");
	});

	it("reports the step before running it", async () => {
		const order: string[] = [];
		const harness = setup(
			createRunSignals(),
			[
				{
					id: "map_reads",
					description: "Map reads.",
					run: async () => {
						order.push("ran");
					},
				},
			],
			async () => {
				order.push("reported");
			},
		);

		await harness.run();

		expect(order).toEqual(["reported", "ran"]);
	});

	// The jobs API not knowing which step is executing is not something to
	// continue past, so it ends the run rather than propagating or being ignored.
	it("fails the run when onStepStart rejects, without running the step", async () => {
		const failure = new Error("jobs API unreachable");
		const harness = setup(
			createRunSignals(),
			[visitStep("first"), visitStep("second")],
			async () => {
				throw failure;
			},
		);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "failed", error: failure });
		expect(harness.context.state.visited).toEqual([]);
	});

	it("reports a step that throws as a failure without rethrowing", async () => {
		const failure = new Error("bowtie2 exited 1");
		const harness = setup(createRunSignals(), [
			throwingStep("map_reads", failure),
			visitStep("never_runs"),
		]);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "failed", error: failure });
		expect(harness.context.state.visited).toEqual([]);
		expect(harness.started).toEqual(["map_reads"]);
	});

	// A step is free to throw a falsy value, and reading the outcome off the
	// captured error alone would report that as a clean run.
	it("reports a step that throws undefined as a failure", async () => {
		const harness = setup(createRunSignals(), [
			throwingStep("map_reads", undefined),
		]);

		expect(await harness.run()).toEqual({ state: "failed" });
	});

	it("reports cancellation when the cancelled flag is set", async () => {
		const signals = createRunSignals();
		const gate = deferred();
		const harness = setup(signals, [
			{
				id: "long_step",
				description: "Take a while.",
				run: async () => {
					signals.cancel();
					await gate.promise;
				},
			},
			visitStep("never_runs"),
		]);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "cancelled" });
		expect(harness.context.state.visited).toEqual([]);
		expect(harness.logged("workflow cancelled")).toBe(true);

		gate.resolve();
	});

	it("reports termination as a failure", async () => {
		const signals = createRunSignals();
		const gate = deferred();
		const harness = setup(signals, [
			{
				id: "long_step",
				description: "Take a while.",
				run: async () => {
					signals.terminate();
					await gate.promise;
				},
			},
		]);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "failed" });
		expect(harness.logged("workflow terminated")).toBe(true);
		expect(harness.logged("workflow terminated without sigterm")).toBe(false);

		gate.resolve();
	});

	// Nothing should be able to abort without setting a flag, which is why the
	// run loop says so rather than silently reporting a plain termination.
	it("warns when the run aborts with neither flag set", async () => {
		const controller = new AbortController();
		const signals: RunSignals = {
			signal: controller.signal,
			isCancelled: () => false,
			isTerminated: () => false,
			cancel: () => {},
			terminate: () => {},
		};
		const gate = deferred();
		const harness = setup(signals, [
			{
				id: "long_step",
				description: "Take a while.",
				run: async () => {
					controller.abort();
					await gate.promise;
				},
			},
		]);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "failed" });
		expect(harness.logged("workflow terminated without sigterm")).toBe(true);

		gate.resolve();
	});

	// A step forwarding `context.signal` to an abort-aware API rejects from that
	// API's abort listener, which is registered inside the step and so runs
	// before the run loop's own. The rejection must not be read as a step
	// failure, or a cancelled job reports as failed and the cancellation
	// disappears.
	it("reports a step that rejects on abort as cancellation", async () => {
		const signals = createRunSignals();
		const started = deferred();
		const harness = setup(signals, [
			{
				id: "abort_aware_step",
				description: "Reject when the signal aborts.",
				run: (context) =>
					new Promise((_resolve, reject) => {
						context.signal.addEventListener("abort", () => {
							reject(new Error("This operation was aborted"));
						});
						started.resolve();
					}),
			},
		]);

		const running = harness.run();

		await started.promise;

		signals.cancel();

		expect(await running).toEqual({ state: "cancelled" });
		expect(harness.logged("workflow step rejected on abort")).toBe(true);
	});

	it("checks the signal before starting each step", async () => {
		const signals = createRunSignals();
		const harness = setup(signals, [
			{
				id: "first",
				description: "Cancel once finished.",
				run: async (context) => {
					context.state.visited.push("first");
					signals.cancel();
				},
			},
			visitStep("never_runs"),
		]);

		const outcome = await harness.run();

		expect(outcome).toEqual({ state: "cancelled" });
		expect(harness.context.state.visited).toEqual(["first"]);
		expect(harness.started).toEqual(["first"]);
	});
});

describe("runWorkflow cancellation of an in-flight step", () => {
	const rejections: unknown[] = [];

	function onUnhandledRejection(reason: unknown) {
		rejections.push(reason);
	}

	afterEach(() => {
		process.off("unhandledRejection", onUnhandledRejection);
		rejections.length = 0;
	});

	it("abandons the step without waiting, and swallows its later rejection", async () => {
		process.on("unhandledRejection", onUnhandledRejection);

		const signals = createRunSignals();
		const started = deferred();
		const gate = deferred();
		let finished = false;

		const harness = setup(signals, [
			{
				id: "long_step",
				description: "Take a while.",
				run: async () => {
					started.resolve();
					await gate.promise;
					finished = true;
				},
			},
		]);

		const running = harness.run();

		await started.promise;

		signals.cancel();

		expect(await running).toEqual({ state: "cancelled" });
		expect(finished).toBe(false);

		// The abandoned step keeps running and eventually fails. Nothing is
		// awaiting it any more, so without the catch the run loop attaches, this
		// would take the process down before the caller finished reporting the run.
		gate.reject(new Error("bowtie2 killed"));

		// Node fires `unhandledRejection` once the microtask queue drains, so a
		// timer is what gives it the chance to. Waiting on the log line instead
		// would assert the catch ran rather than that nothing escaped it.
		await new Promise((resolve) => {
			setTimeout(resolve, 20);
		});

		expect(rejections).toEqual([]);
		expect(
			harness.logged("abandoned workflow step rejected after the run ended"),
		).toBe(true);
	});
});
