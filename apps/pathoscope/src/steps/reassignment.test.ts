import {
	createFakeAnalysis,
	createFakeContext,
	createFakeJobsApiClient,
	createJobsApiState,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { PathoscopeData } from "../context";
import type { PathoscopeState } from "../state";
import { reassignmentStep } from "./reassignment";

const ANALYSIS_ID = 11;

/**
 * The empty-candidate path, which finalizes without running the reassignment
 * subprocess. It is the branch that owes the analysis a result even when no OTU
 * survived elimination, so it exercises the finalize call on its own.
 */
async function runEmptyStep() {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const jobsApiState = createJobsApiState();
	const client = createFakeJobsApiClient(jobsApiState);

	// The finalize route reads the analysis before updating it, so the row has to
	// exist for the call to succeed.
	jobsApiState.analyses.set(
		ANALYSIS_ID,
		createFakeAnalysis({ id: ANALYSIS_ID, workflow: "pathoscope" }),
	);

	const data = { analysisId: ANALYSIS_ID } as PathoscopeData;
	const state: PathoscopeState = {
		candidateSequenceIds: [],
		subtractedCount: 7,
	};

	await reassignmentStep.run(
		createFakeContext(data, state, { client, workPath }),
	);

	return jobsApiState;
}

describe("reassignmentStep", () => {
	it("finalizes an empty result and stamps the workflow version on it", async () => {
		const jobsApiState = await runEmptyStep();

		expect(jobsApiState.finalizeCalls).toHaveLength(1);

		const [call] = jobsApiState.finalizeCalls;

		expect(call?.resource).toBe("analysis");
		expect(call?.id).toBe(ANALYSIS_ID);
		expect(call?.request).toMatchObject({
			results: { subtracted_count: 7, read_count: 0, hits: [] },
			workflowVersion: "1.0.0",
		});
	});
});
