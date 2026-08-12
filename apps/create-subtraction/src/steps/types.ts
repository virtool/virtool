import type { WorkflowStep } from "@virtool/workflow";
import type { CreateSubtractionData } from "../context";
import type { CreateSubtractionState } from "../state";

/** One step of the create_subtraction workflow. */
export type CreateSubtractionStep = WorkflowStep<
	CreateSubtractionData,
	CreateSubtractionState
>;
