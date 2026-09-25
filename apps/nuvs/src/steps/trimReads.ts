import { cacheFor, restoreOrBuild } from "@virtool/workflow";
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
 * and every field skewer is configured with is in the derived key. The whole
 * `trimmed/` directory is the artifact, `trim.log` included, because that is
 * what every blob in the namespace holds.
 */
export const trimReadsStep: NuvsStep = {
	id: "trim_reads",
	description: "Trim reads using Skewer.",
	async run(context) {
		const { data, logger, proc, runSubprocess, workPath } = context;
		const paths = workPaths(workPath);
		const minLength = calculateTrimmingMinLength(data.sample.maxLength);
		const mode: SkewerMode = data.sample.paired ? "pe" : "any";

		const params = buildTrimmedReadsCacheParams({
			minLength,
			mode,
			sampleId: data.sample.id,
			toolVersion: await getSkewerVersion(runSubprocess),
			workflowVersion: APP_VERSION,
		});

		await restoreOrBuild({
			cache: cacheFor(context),
			kind: "trimmed_reads",
			params,
			directory: paths.trimmedDir,
			logger: logger.child({ parentId: data.sample.id, minLength, mode }),
			build: () =>
				runSkewer({
					minLength,
					mode,
					outputPath: paths.trimmedDir,
					proc,
					readPaths: data.reads.map((read) => read.path),
					runSubprocess,
					stagingParent: workPath,
				}),
		});
	},
};
