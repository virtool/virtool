import { deriveCacheKey, WorkflowError } from "@virtool/workflow";
import { cacheFor } from "../cache";
import { buildTrimmedReadsCacheParams } from "../cacheParams";
import { workPaths } from "../paths";
import {
	calculateTrimmingMinLength,
	getSkewerVersion,
	runSkewer,
	type SkewerMode,
} from "../skewer";
import { APP_VERSION } from "../version";
import type { NuvsStep } from "./types";

/**
 * Trim the sample's reads with skewer, reusing another run's work where it can.
 *
 * The `trimmed_reads` namespace is nuvs' own — pathoscope maps untrimmed reads —
 * but it is shared with **Python nuvs**, and every field skewer is configured
 * with is in the derived key. The whole `trimmed/` directory is the artifact,
 * `trim.log` included, because that is what Python archives.
 */
export const trimReadsStep: NuvsStep = {
	id: "trim_reads",
	description: "Trim reads using Skewer.",
	async run(context) {
		const { data, logger, proc, runSubprocess, workPath } = context;
		const paths = workPaths(workPath);
		const cache = cacheFor(context);

		const minLength = calculateTrimmingMinLength(data.sample.maxLength);
		const mode: SkewerMode = data.sample.paired ? "pe" : "any";

		const params = buildTrimmedReadsCacheParams({
			minLength,
			mode,
			sampleId: data.sample.id,
			toolVersion: await getSkewerVersion(runSubprocess),
			workflowVersion: APP_VERSION,
		});

		const key = deriveCacheKey(params);
		const log = logger.child({
			cacheKind: "trimmed_reads",
			key,
			parentId: data.sample.id,
		});

		const restored = await cache.get(key, workPath);

		if (restored !== null) {
			// A blob's one top-level entry is named after the directory its writer
			// archived, and this namespace is shared with Python — so a blob archived
			// from a differently named directory unpacks *beside* the trimmed reads
			// rather than onto them. Thrown rather than treated as a miss:
			// `cache.put` cannot replace a registered key, so re-trimming would hand
			// the same blob back to every later run while leaving the stray tree on a
			// disk sized for one copy of the reads.
			if (restored !== paths.trimmedDir) {
				throw new WorkflowError(
					`Cached trimmed reads restored to ${restored}, not ${paths.trimmedDir}`,
				);
			}

			log.info("restored cached trimmed reads");

			return;
		}

		log.info({ minLength, mode }, "trimming reads");

		await runSkewer({
			minLength,
			mode,
			outputPath: paths.trimmedDir,
			proc,
			readPaths: data.reads.map((read) => read.path),
			runSubprocess,
			stagingParent: workPath,
		});

		// An already-registered key is success, not an error: another run can have
		// derived the same key and trimmed the same reads while this one was
		// working.
		const created = await cache.put(key, paths.trimmedDir, params);

		log.info({ created }, "cached trimmed reads");
	},
};
