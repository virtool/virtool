/**
 * The create_subtraction workflow: two steps and one external tool.
 *
 * A user uploads a genome; this turns it into a subtraction an analysis can
 * eliminate reads against. It counts the genome's sequences and nucleotides with
 * `seqkit` and hands the jobs API those figures alongside the file it stored.
 *
 * **There is deliberately no third step building a bowtie2 index.** Nothing
 * reads `.bt2` shards — both analysis workflows build a subtraction's index
 * locally — and the finalize route accepts the genome alone. So the image
 * carries `seqkit` and no other binary.
 *
 * **Nothing here decompresses the genome to disk.** `seqkit` reads gzip
 * natively, so no step needs a plain FASTA. Don't add a decompress step to make
 * one available.
 *
 * Step ids are `snake_case` and are stored in the `jobs.steps` column, which
 * the UI renders, so renaming one changes what users see.
 */

import { defineWorkflow } from "@virtool/workflow";
import { buildCreateSubtractionContext } from "./context";
import { createCreateSubtractionState } from "./state";
import { computeGcAndCountStep } from "./steps/computeGcAndCount";
import { finalizeStep } from "./steps/finalize";

export const createSubtractionWorkflow = defineWorkflow({
	name: "create_subtraction",
	buildContext: buildCreateSubtractionContext,
	createState: createCreateSubtractionState,
	steps: [computeGcAndCountStep, finalizeStep],
});
