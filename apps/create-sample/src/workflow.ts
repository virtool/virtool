/**
 * The create_sample workflow: two steps and one external tool.
 *
 * A user uploads one or two FASTQ files; this turns them into a sample an
 * analysis can run against. It measures their quality with `fastqc`, normalizes
 * them to `reads_{1,2}.fq.gz` and hands the jobs API the report alongside the
 * files it stored.
 *
 * **Nothing here decompresses a read file to disk.** FastQC reads gzip
 * natively, and an already-gzipped upload is renamed onto its target rather
 * than round-tripped through gzip. A paired sample is several gigabytes; the
 * cheap path is the one that matters.
 *
 * Step ids are `snake_case` and match the Python function names they were
 * ported from. The jobs API stores them, so renaming one changes the shape of a
 * job's step list at cutover.
 */

import { defineWorkflow } from "@virtool/workflow";
import { buildCreateSampleContext } from "./context";
import { createCreateSampleState } from "./state";
import { finalizeStep } from "./steps/finalize";
import { runFastqcStep } from "./steps/runFastqc";

export const createSampleWorkflow = defineWorkflow({
	name: "create_sample",
	buildContext: buildCreateSampleContext,
	createState: createCreateSampleState,
	steps: [runFastqcStep, finalizeStep],
});
