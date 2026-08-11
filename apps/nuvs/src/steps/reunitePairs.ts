import { trimmedReadPaths, workPaths } from "../paths";
import { filterFastqByIds, readFastqIds } from "../sequences";
import type { NuvsStep } from "./types";

/**
 * Rebuild the read pairs SPAdes needs from the reads that survived elimination.
 *
 * The two elimination passes ran over both mates as unpaired reads, so what they
 * left is a flat file in which one mate may have survived and the other not.
 * SPAdes wants two files whose records correspond, so each trimmed file is
 * filtered down to the ids that made it through — a read whose mate was
 * eliminated is therefore dropped from both.
 *
 * **Single-end runs do nothing here**, and `assemble` reads
 * `unmapped_subtractions.fq` directly in that case.
 *
 * Python decompresses both trimmed files to disk before filtering them. This
 * gunzips them in the stream instead: the decompressed copies are read once,
 * never read again, and are gigabytes on a disk sized for one copy of the reads.
 */
export const reunitePairsStep: NuvsStep = {
	id: "reunite_pairs",
	description: "Reunite paired reads after elimination.",
	async run({ data, logger, workPath }) {
		if (!data.sample.paired) {
			return;
		}

		const paths = workPaths(workPath);

		// The one thing that accumulates. Python holds the same set, and there is
		// no filtering by membership without it.
		const ids = await readFastqIds(paths.unmappedSubtractions);

		logger.info({ readCount: ids.size }, "read surviving read ids");

		const sources = trimmedReadPaths(paths, true);

		// Sequentially: the two streams would otherwise contend for the same disk,
		// and each already runs at whatever the volume will give it.
		for (const [index, source] of sources.entries()) {
			await filterFastqByIds({
				ids,
				source,
				sourceGzipped: true,
				target: paths.unmappedPair(index + 1),
			});
		}
	},
};
