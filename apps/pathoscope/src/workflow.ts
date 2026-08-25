/**
 * The pathoscope workflow: eight steps, four external tools and the Rust core.
 *
 * Pathoscope quantifies known viruses in a sample. It collapses redundant
 * isolates out of the reference, maps the sample against full-source
 * representatives to find candidates, rebuilds an index carrying every
 * collapsed isolate of just those OTUs, maps again, drops reads that belong to
 * the host, and finally reassigns the reads that matched more than one isolate.
 *
 * Step ids are `snake_case`. The jobs API stores them in the `jobs.steps`
 * column and the UI renders them, so renaming one changes what users see, on
 * jobs already written as well as new ones.
 *
 * There is deliberately **no delete-on-failure**. A failed run leaves its
 * half-built analysis for the user to delete, and the jobs API has no delete
 * route to call.
 */

import { defineWorkflow } from "@virtool/workflow";
import { buildPathoscopeContext } from "./context";
import { createPathoscopeState } from "./state";
import { collapseReferenceStep } from "./steps/collapseReference";
import {
	createRepresentativeIndexStep,
	createSubtractionIndexStep,
} from "./steps/createIndexes";
import { eliminateSubtractionStep } from "./steps/eliminateSubtraction";
import {
	buildCandidateOtuIndexStep,
	mapIsolatesStep,
	mapRepresentativesStep,
} from "./steps/mapping";
import { reassignmentStep } from "./steps/reassignment";

export const pathoscopeWorkflow = defineWorkflow({
	name: "pathoscope",
	buildContext: buildPathoscopeContext,
	createState: createPathoscopeState,
	steps: [
		collapseReferenceStep,
		createRepresentativeIndexStep,
		createSubtractionIndexStep,
		mapRepresentativesStep,
		buildCandidateOtuIndexStep,
		mapIsolatesStep,
		eliminateSubtractionStep,
		reassignmentStep,
	],
});
