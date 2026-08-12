/**
 * The create_subtraction workflow: two steps and one external tool.
 *
 * A user uploads a genome; this turns it into a subtraction an analysis can
 * eliminate reads against. It counts the genome's sequences and nucleotides with
 * `seqkit` and hands the jobs API those figures alongside the file it stored.
 *
 * Python has a third step, `build_index`, which runs `bowtie2-build` and uploads
 * six `.bt2` shards. It is deliberately not ported — nothing reads those shards,
 * and the finalize route accepts the genome alone. So the image carries `seqkit`
 * and no other binary.
 *
 * **Nothing here decompresses the genome to disk.** Python used to, in a
 * `decompress` step; it dropped that once `seqkit` and `bowtie2-build` were
 * reading gzip natively, and this side follows. Don't reintroduce the step to
 * make a plain FASTA available — no step needs one.
 *
 * Step ids are `snake_case` and match the Python function names they were ported
 * from. The jobs API stores them, so renaming one changes the shape of a job's
 * step list at cutover.
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
