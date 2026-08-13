/**
 * Every path this workflow reads or writes under its work path.
 *
 * Uploads land in `{work_path}/uploads/` under the names the user gave them,
 * matching Python. The normalized reads do **not**: they go in
 * `{work_path}/reads/`, where Python writes them beside their sources with
 * `path.with_name(f"reads_{i + 1}.fq.gz")`.
 *
 * That divergence closes a collision. Upload names are user-supplied, so a
 * sample whose second upload happens to be called `reads_1.fq.gz` has Python
 * rename the *first* upload onto it — destroying the second's bytes — and then
 * rename what is now the first upload's content to `reads_2.fq.gz`. The sample
 * finalizes with one read stored twice, and nothing reports a problem. Separate
 * directories make the target names unreachable from the source names.
 *
 * The rename stays a rename: both directories sit under the one work path and
 * so on one filesystem, which is all `rename(2)` requires. Python's constraint
 * was `with_name`'s, not the syscall's.
 *
 * The quality blobs get a directory of their own rather than the bare work
 * path, for the same reason: one file per read, named by the read's position,
 * so nothing has to be matched back to the upload it describes.
 */

import { join } from "node:path";

/** One upload, and the reads file it becomes. */
export type ReadPaths = {
	/** The upload, as downloaded, under the name the user gave it. */
	upload: string;

	/** `reads_{n}.fq.gz`, in a directory no upload name can reach. */
	normalized: string;

	/** Where `quality-core` writes this read's quality blob. */
	qualityOutput: string;
};

/** Every path one create_sample run uses. */
export type CreateSamplePaths = {
	/** One entry per upload, in `sample_uploads.index` order. */
	reads: ReadPaths[];
};

/**
 * The name a normalized read takes, by position.
 *
 * `sample_reads.name` is a `VARCHAR(13)` upstream and the jobs API whitelists
 * exactly these two, so the position an upload held in the create request is
 * the whole of what decides its name.
 */
export function readsFileName(index: number): string {
	return `reads_${index + 1}.fq.gz`;
}

export function workPaths(
	workPath: string,
	uploadNames: readonly string[],
): CreateSamplePaths {
	return {
		reads: uploadNames.map((name, index) => ({
			upload: join(workPath, "uploads", name),
			normalized: join(workPath, "reads", readsFileName(index)),
			qualityOutput: join(workPath, "quality", `${index + 1}.json`),
		})),
	};
}
