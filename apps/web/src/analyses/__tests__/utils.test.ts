import {
	checkCanRemoveAnalysis,
	getWorkflowVersionLabel,
} from "@analyses/utils";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import type { JobState } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

describe("getWorkflowVersionLabel", () => {
	it("returns the version verbatim when one was recorded", () => {
		expect(
			getWorkflowVersionLabel({ ready: true, workflowVersion: "1.2.3" }),
		).toBe("1.2.3");
	});

	it("distinguishes a never-recorded version from a recorded-but-unknown one", () => {
		expect(
			getWorkflowVersionLabel({ ready: true, workflowVersion: null }),
		).toBe("not recorded");
		expect(
			getWorkflowVersionLabel({ ready: true, workflowVersion: "UNKNOWN" }),
		).toBe("Unknown");
	});

	it("reads an unready analysis as pending rather than unrecorded", () => {
		expect(
			getWorkflowVersionLabel({ ready: false, workflowVersion: null }),
		).toBe("Pending");
	});
});

describe("checkCanRemoveAnalysis", () => {
	function withJob(state: JobState) {
		const { job } = createFakeAnalysisMinimal();

		return { job: job && { ...job, state } };
	}

	// An OOM-killed or evicted pod leaves the analysis unready forever, so a
	// terminal job keeps it removable. A job that has not finished withholds
	// removal even once the analysis is ready, because the workflow writes its
	// result before the job is marked terminal.
	it.each<[JobState, boolean]>([
		["pending", false],
		["running", false],
		["cancelled", true],
		["failed", true],
		["succeeded", true],
	])("decides for a job that is %s", (state, expected) => {
		expect(checkCanRemoveAnalysis(withJob(state))).toBe(expected);
	});

	it("allows an analysis with no job", () => {
		expect(checkCanRemoveAnalysis({ job: null })).toBe(true);
	});

	it("prefers the fetched job to the one the analysis embeds", () => {
		expect(
			checkCanRemoveAnalysis(withJob("running"), { state: "failed" }),
		).toBe(true);
		expect(
			checkCanRemoveAnalysis(withJob("succeeded"), { state: "running" }),
		).toBe(false);
	});
});
