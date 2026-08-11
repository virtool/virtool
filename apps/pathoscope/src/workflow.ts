/**
 * The pathoscope workflow: eight steps, four external tools and the Rust core.
 *
 * Pathoscope quantifies known viruses in a sample. It collapses redundant
 * isolates out of the reference, maps the sample against one representative per
 * OTU to find candidates, rebuilds an index carrying every isolate of just those
 * OTUs, maps again, drops reads that belong to the host, and finally reassigns
 * the reads that matched more than one isolate.
 *
 * Step ids are `snake_case` and match the Python function names they were ported
 * from. The jobs API stores them, so renaming one changes the shape of a job's
 * step list at cutover.
 *
 * There is deliberately **no delete-on-failure**. Python registered an
 * `on_failure` hook that issued `DELETE /analyses/{id}`; a failed run now leaves
 * its half-built analysis for the user to delete, and the jobs API has no delete
 * route to call.
 */

import { defineWorkflow } from "@virtool/workflow";
import { buildPathoscopeContext } from "./context";
import { createPathoscopeState } from "./state";
import { collapseReferenceStep } from "./steps/collapseReference";
import {
	createReferenceIndexStep,
	createSubtractionIndexStep,
} from "./steps/createIndexes";
import { eliminateSubtractionStep } from "./steps/eliminateSubtraction";
import {
	buildIsolateIndexStep,
	mapDefaultIsolatesStep,
	mapIsolatesStep,
} from "./steps/mapping";
import { reassignmentStep } from "./steps/reassignment";

export const pathoscopeWorkflow = defineWorkflow({
	name: "pathoscope",
	buildContext: buildPathoscopeContext,
	createState: createPathoscopeState,
	steps: [
		collapseReferenceStep,
		createReferenceIndexStep,
		createSubtractionIndexStep,
		mapDefaultIsolatesStep,
		buildIsolateIndexStep,
		mapIsolatesStep,
		eliminateSubtractionStep,
		reassignmentStep,
	],
});
