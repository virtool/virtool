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
import { HmmAnnotationRecord } from "@virtool/contracts";
import { WorkflowError } from "@virtool/workflow";
import { z } from "zod";

/*
 * Derived from the shared record rather than restated, so this cannot come to
 * disagree with what writes the blob. `pick` keeps zod's default strip
 * behaviour, so the fields this workflow does not read are ignored rather than
 * required — a blob Python wrote, or one written by a later version carrying
 * more, still reads.
 */
const ClusterAnnotations = z.array(
	HmmAnnotationRecord.pick({ cluster: true, id: true }),
);

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

	const result = ClusterAnnotations.safeParse(parsed);

	if (!result.success) {
		throw new HmmAnnotationsMalformedError(
			`The HMM annotations blob is not a list of annotations: ${result.error.issues
				.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
				.slice(0, 3)
				.join("; ")}`,
		);
	}

	const clusters = new Map<number, number>();

	for (const { cluster, id } of result.data) {
		clusters.set(cluster, id);
	}

	return clusters;
}
