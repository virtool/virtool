import { describe, expect, it } from "vitest";
import { createSampleWorkflow } from "./workflow";

describe("createSampleWorkflow", () => {
	/**
	 * The jobs API stores a step id and the SPA renders a job's step list from
	 * it, so these must stay the Python function names they were ported from
	 * until the cutover completes.
	 */
	it("declares Python's steps, in order, under Python's names", () => {
		expect(createSampleWorkflow.steps.map((step) => step.id)).toStrictEqual([
			"run_fastqc",
			"finalize",
		]);
	});

	it("claims jobs for the create_sample workflow", () => {
		expect(createSampleWorkflow.name).toBe("create_sample");
	});

	/**
	 * Python's `@step(name="Run FastQC")` overrides the title-cased default,
	 * which would otherwise render as "Run Fastqc".
	 */
	it("keeps FastQC's capitalisation in the display name", () => {
		expect(createSampleWorkflow.steps[0]?.name).toBe("Run FastQC");
	});

	/**
	 * Python registers an `@hooks.on_failure` that issues `DELETE /samples/{id}`.
	 * It is deliberately not ported: a failed run leaves an unfinalized sample
	 * for the user to delete, and the jobs API exposes no destructive route a
	 * job key could reach.
	 */
	it("declares no result payload, as a sample is not an analysis", () => {
		expect(createSampleWorkflow.result).toBeUndefined();
	});
});
