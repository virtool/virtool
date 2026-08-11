import type { WorkflowStep } from "@virtool/workflow";
import type { PathoscopeData } from "../context";
import type { PathoscopeState } from "../state";

/** One step of the pathoscope workflow. */
export type PathoscopeStep = WorkflowStep<PathoscopeData, PathoscopeState>;
