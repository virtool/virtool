import { parseWorkflowRunConfig, runWorkflowApp } from "@virtool/workflow";
import runtimePkg from "../../../packages/workflow/package.json" with {
	type: "json",
};
import { APP_VERSION } from "./version";
import { createSampleWorkflow } from "./workflow";

/**
 * The create-sample workflow executor: a one-shot process that claims a job,
 * runs it, reports how it ended, and exits.
 *
 * Everything past this line belongs to `runWorkflowApp` — the claim, the ping
 * loop, the SIGTERM handler and the exit code. A failed workflow exits **0**:
 * failure is a transition the jobs API owns, and a non-zero exit makes the
 * `ScaledJob` retry the pod.
 */
await runWorkflowApp({
	workflow: createSampleWorkflow,
	config: parseWorkflowRunConfig(process.env),
	runtimeVersion: runtimePkg.version,
	workflowVersion: APP_VERSION,
});
