import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { openWorkflowIndex, writeFasta } from "@virtool/workflow";
import { workPaths } from "../paths";
import type { NuvsStep } from "./types";

/**
 * Write the index's default-isolate sequences to a local FASTA.
 *
 * One representative per OTU, which is all the elimination pass needs: this
 * mapping exists to discard reads that belong to a virus the reference already
 * knows about, and an isolate-level distinction would not change which reads
 * survive.
 *
 * **Sequence order is the output.** It decides FASTA order, so bowtie2 index
 * order, so every SAM line downstream — the reader's `ORDER BY` clauses are what
 * make that reproducible and are not to be touched.
 *
 * Unlike pathoscope, which writes this FASTA lazily from inside
 * `createMappingIndex` so a cache hit never scans the reference, nuvs writes it
 * in a step of its own. That is Python's shape and the step id is stored by the
 * jobs API, so the scan is paid even on a hit.
 */
export const createReferenceFastaStep: NuvsStep = {
	id: "create_reference_fasta",
	name: "Create reference FASTA",
	description: "Write the index's default-isolate sequences to a local FASTA.",
	async run({ data, logger, workPath }) {
		const paths = workPaths(workPath);

		await mkdir(dirname(paths.referenceFasta), { recursive: true });

		const index = openWorkflowIndex({
			id: data.index.id,
			path: data.index.path,
		});

		try {
			// Streamed from SQLite straight to disk: a real reference exceeds V8's
			// maximum string length, so nothing here may materialise it.
			await writeFasta(paths.referenceFasta, index.iterDefaultSequences());
		} finally {
			index.close();
		}

		logger.info(
			{ fastaPath: paths.referenceFasta },
			"wrote default isolate fasta",
		);
	},
};
