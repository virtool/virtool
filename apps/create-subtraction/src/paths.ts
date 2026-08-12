/**
 * Every path this workflow reads or writes under its work path.
 *
 * There are only two, and **the run never writes a decompressed genome**. The
 * scan gunzips through a stream and the index is not built here, so nothing
 * needs the plain FASTA on disk — a decompressed chromosome is tens of
 * gigabytes of writes that only ever get read once and thrown away.
 */

import { join } from "node:path";

/** Every path one create_subtraction run uses. */
export type CreateSubtractionPaths = {
	/**
	 * The upload, as downloaded.
	 *
	 * Named `subtraction.fa.gz` whether or not it is actually gzipped, matching
	 * Python — a user is free to upload a plain FASTA.
	 */
	upload: string;

	/**
	 * Where the genome is gzipped to, when the upload was not already gzipped.
	 *
	 * A sibling of {@link upload} rather than that path itself: writing in place
	 * would truncate the file being compressed. An already-gzipped upload never
	 * reaches this path at all — it is uploaded as it stands.
	 */
	compressedFasta: string;
};

export function workPaths(
	workPath: string,
	subtractionId: number,
): CreateSubtractionPaths {
	return {
		upload: join(
			workPath,
			"subtractions",
			String(subtractionId),
			"subtraction.fa.gz",
		),
		compressedFasta: join(workPath, "subtraction.fa.gz"),
	};
}
