import { describe, expect, it } from "vitest";
import { createSampleWorkflow } from "./workflow";

describe("createSampleWorkflow", () => {
	/**
	 * A step id is stored in the `jobs.steps` column and the SPA renders a job's
	 * step list from it, so renaming one changes what users see.
	 */
	it("declares the two steps, in order", () => {
		expect(createSampleWorkflow.steps.map((step) => step.id)).toStrictEqual([
			"run_fastqc",
			"finalize",
		]);
	});

	it("claims jobs for the create_sample workflow", () => {
		expect(createSampleWorkflow.name).toBe("create_sample");
	});

	/**
	 * The id above is what the jobs API stores and what a step list is keyed by;
	 * the display name is free to stop naming a tool this image no longer
	 * carries.
	 */
	it("names the step for what it measures rather than the tool", () => {
		expect(createSampleWorkflow.steps[0]?.name).toBe("Measure quality");
	});

	/**
	 * There is deliberately no delete on failure: a failed run leaves an
	 * unfinalized sample for the user to delete, and the jobs API exposes no
	 * destructive route a job key could reach.
	 */
	it("declares no result payload, as a sample is not an analysis", () => {
		expect(createSampleWorkflow.result).toBeUndefined();
	});
});
