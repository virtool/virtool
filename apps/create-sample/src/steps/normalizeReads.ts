import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { gzipFile, recompressBzip2File } from "@virtool/workflow";
import type { CreateSampleStep } from "./types";

/**
 * Put every upload in `{work_path}/reads/` as a gzipped read file.
 *
 * This runs first because `quality-core` can't read bzip2.
 *
 * **An already-gzipped upload is renamed, not recompressed.** Almost every one
 * is, so compressing here would mean decompressing a read file and gzipping it
 * back to produce bytes the user already sent — and these run to several
 * gigabytes each.
 */
export const normalizeReadsStep: CreateSampleStep = {
	/* Stored in the `jobs.steps` column and rendered by the UI, so renaming it
	 * changes what users see. */
	id: "normalize_reads",
	name: "Normalize reads",
	description: "Convert the uploaded read files to gzip.",
	async run({ data, logger, proc, runSubprocess }) {
		for (const [index, read] of data.paths.reads.entries()) {
			const format = data.uploadFormats[index];

			// `buildContext` fills one entry per read. Defaulting a missing one to
			// any branch is silently wrong: compressing an already-gzipped upload
			// double-gzips it, and renaming a plain one stores a file the name says
			// is compressed and nothing can read.
			if (format === undefined) {
				throw new Error(`No upload format recorded for read ${index + 1}`);
			}

			if (format === "gzip") {
				await mkdir(dirname(read.normalized), { recursive: true });
				await rename(read.upload, read.normalized);
				continue;
			}

			const options = {
				proc,
				runSubprocess,
				source: read.upload,
				target: read.normalized,
			};

			const { cancelled } =
				format === "bzip2"
					? await recompressBzip2File(options)
					: await gzipFile(options);

			// The target holds part of a read file at best. `cancelled` is only ever
			// true with the run's signal already aborted, so the run loop stops
			// before `run_fastqc` can read it.
			if (cancelled) {
				return;
			}
		}

		logger.info({ formats: data.uploadFormats }, "normalized reads");
	},
};
