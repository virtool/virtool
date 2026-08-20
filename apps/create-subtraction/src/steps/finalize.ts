import type {
	FinalizeSubtractionRequest,
	SubtractionFileManifest,
} from "@virtool/contracts";
import { mintStorageKey } from "@virtool/storage";
import { gzipFile, uploadFromPath } from "@virtool/workflow";
import type { CreateSubtractionStep } from "./types";

/**
 * The one filename a subtraction accepts.
 *
 * The genome alone is written, and no bowtie2 shards alongside it: nothing
 * consumes shards, because both analysis workflows build a subtraction's index
 * locally from this file and memoize it in their own cache. The jobs API's
 * finalize route whitelists this name and rejects the rest, so a run that wrote
 * more could not finalize at all.
 */
const FASTA_NAME = "subtraction.fa.gz";

/**
 * Compress the genome, write it to object storage and hand the subtraction its
 * figures.
 *
 * The key is **minted**, not composed: nothing derives a key from row identity
 * on either side, and the route records what it is sent after checking it sits
 * under this subtraction's prefix. The manifest carries no size — the route
 * measures the object it was pointed at, so a declared byte count would be a
 * field nothing stores and nothing checks.
 *
 * One call, carrying the figures and the manifest together, so a run cannot end
 * with the subtraction flipped ready and its file row missing.
 *
 * **An already-gzipped upload is uploaded as it stands.** Almost every one is,
 * so compressing here would mean decompressing a genome and gzipping it back to
 * produce a file the user already sent — tens of gigabytes of pointless IO on a
 * large reference.
 *
 * **There is no delete on failure.** A failed run leaves an unfinalized row for
 * the user to remove, and the jobs API exposes no destructive route a job key
 * could reach.
 */
export const finalizeStep: CreateSubtractionStep = {
	id: "finalize",
	description: "Upload the compressed genome and finalize the subtraction.",
	async run({ client, data, logger, proc, runSubprocess, state, storage }) {
		const { count, gc } = state;

		// `compute_gc_and_count` fills both. Reaching finalize without them means
		// the run is not the sequence of steps this workflow declares.
		if (count === null || gc === null) {
			throw new Error("Genome composition was not computed before finalize");
		}

		let path = data.paths.upload;

		if (!data.uploadIsGzipped) {
			path = data.paths.compressedFasta;

			await gzipFile({
				proc,
				runSubprocess,
				source: data.paths.upload,
				target: path,
			});
		}

		const storageKey = mintStorageKey("subtractions", data.subtractionId);

		const size = await uploadFromPath(storage, storageKey, path);

		logger.info({ size, storageKey }, "uploaded compressed genome");

		const files: SubtractionFileManifest[] = [
			{ kind: "subtractionFile", name: FASTA_NAME, storageKey },
		];

		const body: FinalizeSubtractionRequest = { count, gc, files };

		await client.request({
			method: "PATCH",
			path: `/subtractions/${data.subtractionId}`,
			body,
		});

		logger.info(
			{ count, subtractionId: data.subtractionId },
			"finalized subtraction",
		);
	},
};
