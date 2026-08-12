import type { WorkflowStep } from "@virtool/workflow";
import type { CreateSampleData } from "../context";
import type { CreateSampleState } from "../state";

/** One step of the create_sample workflow. */
export type CreateSampleStep = WorkflowStep<
	CreateSampleData,
	CreateSampleState
>;
