import type { WorkflowStep } from "@virtool/workflow";
import type { NuvsData } from "../context";
import type { NuvsState } from "../state";

/** One step of the nuvs workflow. */
export type NuvsStep = WorkflowStep<NuvsData, NuvsState>;
