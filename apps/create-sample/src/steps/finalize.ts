import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { compressFile } from "@virtool/archive/compression";
import type {
	FinalizeSampleRequest,
	SampleReadManifest,
} from "@virtool/contracts";
import { mintStorageKey } from "@virtool/storage";
import { uploadFromPath } from "@virtool/workflow";
import { readsFileName } from "../paths";
import type { CreateSampleStep } from "./types";

/**
 * Normalize the reads, write them to object storage and hand the sample its
 * quality data.
 *
 * The key is **minted**, not composed: nothing derives a key from row identity
 * on either side, and the route records what it is sent after checking it sits
 * under this sample's prefix. The manifest carries no size — the route measures
 * the object it was pointed at, so a declared byte count would be a field
 * nothing stores and nothing checks.
 *
 * One call, carrying the quality data and the manifest together, so a run
 * cannot end with the sample flipped ready and its reads rows missing.
 *
 * **An already-gzipped upload is renamed, not recompressed.** Almost every one
 * is, so compressing here would mean decompressing a read file and gzipping it
 * back to produce bytes the user already sent — and these run to several
 * gigabytes each. Python takes the same branch.
 *
 * The uploads are processed in `sample_uploads.index` order and named by
 * position, which is the only thing linking an upload to the reads file it
 * becomes: `finalizeSample` pairs the rows it writes with the uploads by that
 * same order.
 *
 * **There is no delete on failure.** Python registers an `on_failure` hook that
 * issues `DELETE /samples/{id}`; a failed run here leaves an unfinalized row
 * for the user to remove, and the jobs API exposes no destructive route a job
 * key could reach.
 */
export const finalizeStep: CreateSampleStep = {
	id: "finalize",
	description: "Upload the normalized reads and finalize the sample.",
	async run({ client, data, logger, state, storage }) {
		const { quality } = state;

		// `run_fastqc` fills this. Reaching finalize without it means the run is
		// not the sequence of steps this workflow declares.
		if (quality === null) {
			throw new Error("Quality data was not parsed before finalize");
		}

		const files: SampleReadManifest[] = [];

		for (const [index, read] of data.paths.reads.entries()) {
			const gzipped = data.uploadsAreGzipped[index];

			// `buildContext` fills one entry per read. Defaulting a missing one to
			// either branch is silently wrong: compressing an already-gzipped
			// upload double-gzips it, and renaming a plain one stores a file the
			// name says is compressed and nothing can read.
			if (gzipped === undefined) {
				throw new Error(`No gzip status recorded for read ${index + 1}`);
			}

			await mkdir(dirname(read.normalized), { recursive: true });

			if (gzipped) {
				await rename(read.upload, read.normalized);
			} else {
				await compressFile(read.upload, read.normalized);
			}

			const storageKey = mintStorageKey("samples", data.sampleId);

			const size = await uploadFromPath(storage, storageKey, read.normalized);

			logger.info({ size, storageKey }, "uploaded reads file");

			files.push({
				kind: "sampleRead",
				name: readsFileName(index),
				storageKey,
			});
		}

		const body: FinalizeSampleRequest = { quality, files };

		await client.request({
			method: "PATCH",
			path: `/samples/${data.sampleId}`,
			body,
		});

		logger.info(
			{ files: files.length, sampleId: data.sampleId },
			"finalized sample",
		);
	},
};
