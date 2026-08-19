/**
 * The NuVs workflow: ten steps and five external tools.
 *
 * NuVs looks for viruses the reference does *not* already describe. It maps the
 * sample against every known OTU and throws those reads away, throws away what
 * belongs to the host, assembles whatever is left, and searches the resulting
 * contigs for viral protein motifs — so what it reports is, by construction,
 * what nothing else could account for.
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
import { buildNuvsContext } from "./context";
import { createNuvsState } from "./state";
import { assembleStep } from "./steps/assemble";
import {
	createReferenceIndexStep,
	createSubtractionIndexesStep,
} from "./steps/createIndexes";
import { createReferenceFastaStep } from "./steps/createReferenceFasta";
import { eliminateOtusStep } from "./steps/eliminateOtus";
import { eliminateSubtractionStep } from "./steps/eliminateSubtraction";
import { processAssemblyStep } from "./steps/processAssembly";
import { reunitePairsStep } from "./steps/reunitePairs";
import { trimReadsStep } from "./steps/trimReads";
import { vfamStep } from "./steps/vfam";

export const nuvsWorkflow = defineWorkflow({
	name: "nuvs",
	buildContext: buildNuvsContext,
	createState: createNuvsState,
	steps: [
		createReferenceFastaStep,
		trimReadsStep,
		createReferenceIndexStep,
		eliminateOtusStep,
		createSubtractionIndexesStep,
		eliminateSubtractionStep,
		reunitePairsStep,
		assembleStep,
		processAssemblyStep,
		vfamStep,
	],
});
