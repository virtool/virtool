/**
 * The HMM annotations blob, and the one thing this workflow reads out of it.
 *
 * `hmm/annotations.json.gz` is a gzipped JSON array of every annotation in the
 * installed HMM dataset. All this side needs is the cluster-to-id mapping — the
 * `families`, `names` and `entries` each annotation also carries belong to the
 * `hmms` table, and the formatting layer merges them in when the analysis is
 * read. Writing them into the results blob would freeze a copy that goes stale
 * the next time the dataset is reinstalled.
 */

import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { WorkflowError } from "@virtool/workflow";

/** The annotations blob is present but is not what this expects. */
export class HmmAnnotationsMalformedError extends WorkflowError {}

/** A vFam cluster in the profiles has no annotation in the blob. */
export class HmmClusterUnknownError extends WorkflowError {
	constructor(cluster: number) {
		super(
			`No HMM annotation for vFam cluster ${cluster}. The profiles and the annotations blob describe different HMM datasets; reinstall the dataset to rewrite both.`,
		);
	}
}

/**
 * Read `path` and map each annotation's vFam cluster to its id.
 *
 * **This does buffer**, and it is the one place in the workflow that does.
 * `JSON.parse` has no streaming form, and Python reads the same file the same
 * way. The bound is the installed dataset rather than anything about the sample,
 * so it does not grow with the analysis.
 */
export async function readHmmClusterMap(
	path: string,
): Promise<Map<number, number>> {
	const chunks: Buffer[] = [];

	// The last argument is a sink rather than a transform, which is what lets the
	// stream be consumed without a destination file.
	await pipeline(createReadStream(path), createGunzip(), async (source) => {
		for await (const chunk of source) {
			chunks.push(chunk as Buffer);
		}
	});

	let parsed: unknown;

	try {
		parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch (err) {
		throw new HmmAnnotationsMalformedError(
			"The HMM annotations blob is not valid JSON",
			{ cause: err },
		);
	}

	if (!Array.isArray(parsed)) {
		throw new HmmAnnotationsMalformedError(
			`Expected the HMM annotations blob to be an array, got ${typeof parsed}`,
		);
	}

	const clusters = new Map<number, number>();

	for (const annotation of parsed) {
		if (
			typeof annotation !== "object" ||
			annotation === null ||
			typeof (annotation as { cluster?: unknown }).cluster !== "number" ||
			typeof (annotation as { id?: unknown }).id !== "number"
		) {
			throw new HmmAnnotationsMalformedError(
				"An HMM annotation carries no numeric cluster and id",
			);
		}

		const { cluster, id } = annotation as { cluster: number; id: number };

		clusters.set(cluster, id);
	}

	return clusters;
}
