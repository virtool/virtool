/**
 * The `cd-hit-est` cluster file, parsed the way Python's
 * `_parse_cd_hit_clusters` parses it.
 *
 * A cluster file looks like:
 *
 * ```
 * >Cluster 0
 * 0	1200nt, >seq_1... *
 * 1	1198nt, >seq_2... at +/99.83%
 * >Cluster 1
 * 0	900nt, >seq_3... *
 * ```
 *
 * Every member of a cluster is mapped to that cluster's representative — the
 * member whose line ends in `*`. That mapping is what collapsing compares
 * isolates by, so a member left unmapped is a `KeyError` in Python and would be
 * an `undefined` set member here.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

/** The sequence id on a member line: `>{id}...`, non-greedy up to the ellipsis. */
const MEMBER = />(.+?)\.\.\./;

/**
 * Map every sequence id in `path` to its cluster's representative.
 *
 * **The trailing cluster is flushed after EOF.** cd-hit-est writes no terminator
 * after the last cluster, so a parser that only flushes on the next `>Cluster`
 * silently drops it — which for a file with one cluster is the whole result.
 */
export async function parseCdHitClusters(
	path: string,
): Promise<Map<string, string>> {
	const representativesBySequenceId = new Map<string, string>();

	let clusterSequenceIds: string[] = [];
	let representativeId: string | null = null;

	function flushCluster(): void {
		// A cluster with no representative is flushed as a no-op rather than an
		// error, matching Python. cd-hit-est does not produce one.
		if (representativeId === null) {
			return;
		}

		for (const sequenceId of clusterSequenceIds) {
			representativesBySequenceId.set(sequenceId, representativeId);
		}
	}

	// Streamed rather than read whole: one cluster file covers a single OTU
	// segment and is small, but a reference has one per segment per OTU and
	// nothing here needs the file in memory.
	const lines = createInterface({
		crlfDelay: Number.POSITIVE_INFINITY,
		input: createReadStream(path),
	});

	for await (const rawLine of lines) {
		const line = rawLine.trim();

		if (line.startsWith(">Cluster")) {
			flushCluster();

			clusterSequenceIds = [];
			representativeId = null;

			continue;
		}

		const match = MEMBER.exec(line);

		if (match === null) {
			continue;
		}

		// The capture group is not optional, so a match always carries it.
		const sequenceId = match[1] ?? "";

		clusterSequenceIds.push(sequenceId);

		if (line.endsWith("*")) {
			representativeId = sequenceId;
		}
	}

	flushCluster();

	return representativesBySequenceId;
}
