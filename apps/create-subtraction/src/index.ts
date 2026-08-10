import { createLogger } from "@virtool/logger";
import { createStorageBackend } from "@virtool/storage";
import { readConfig } from "./config";
import { checkStorageAccess } from "./storage";

/**
 * The create-subtraction workflow: a one-shot process that claims a job,
 * decompresses the source FASTA, computes its `gc` and `count`, writes the
 * compressed FASTA back to object storage and exits.
 *
 * Python's `build_index` step is deliberately not ported. Nothing consumes a
 * subtraction's bowtie2 shards, and the jobs API's finalize route accepts only
 * `subtraction.fa.gz` — so this workflow runs no external tool and its image
 * needs no bioinformatics binaries.
 *
 * Only the storage half is wired. Claiming a job is the runtime core's job and
 * lands with it, at which point `VT_SUBTRACTION_ID` gives way to the id carried
 * by the claimed job.
 */
async function main(): Promise<void> {
	const config = readConfig();
	const logger = createLogger({ name: "create-subtraction" });

	await checkStorageAccess(
		createStorageBackend(config.storage),
		logger,
		config.subtractionId,
	);

	logger.error("the workflow runtime is not implemented yet");
	process.exitCode = 1;
}

await main();
