/**
 * Building a create_subtraction run's context.
 *
 * One metadata read and one download, both before step 1. An upload whose
 * object is missing therefore fails the run before any work is done, rather
 * than at whichever step first touches the file.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance.
 */

import { isGzipped } from "@virtool/archive/compression";
import { WorkflowSubtraction } from "@virtool/contracts";
import {
	type BuildContextInput,
	downloadToPath,
	readIdArg,
} from "@virtool/workflow";
import { type CreateSubtractionPaths, workPaths } from "./paths";

/** The eagerly resolved data half of a create_subtraction run's context. */
export type CreateSubtractionData = {
	/** The subtraction this run finalizes */
	subtractionId: number;

	/** The subtraction's name, for logging */
	subtractionName: string;

	/** The recorded key of the upload the genome was read from */
	uploadStorageKey: string;

	/**
	 * Whether the upload is actually gzipped.
	 *
	 * The name never says: it is `subtraction.fa.gz` either way. `finalize`
	 * branches on it to decide whether there is anything to compress — seqkit
	 * reads either form, so no other step asks.
	 */
	uploadIsGzipped: boolean;

	paths: CreateSubtractionPaths;
};

export async function buildCreateSubtractionContext({
	client,
	job,
	logger,
	storage,
	workPath,
}: BuildContextInput): Promise<CreateSubtractionData> {
	const subtractionId = readIdArg(job.args, "subtraction_id");
	const paths = workPaths(workPath, subtractionId);

	const subtraction = await client.request({
		method: "GET",
		path: `/subtractions/${subtractionId}`,
		schema: WorkflowSubtraction,
	});

	const uploadStorageKey = resolveUploadStorageKey(subtraction);

	logger.info(
		{ subtractionId, subtractionName: subtraction.name },
		"resolved subtraction metadata",
	);

	await downloadToPath(storage, uploadStorageKey, paths.upload);

	const uploadIsGzipped = await isGzipped(paths.upload);

	logger.info(
		{ path: paths.upload, gzipped: uploadIsGzipped },
		"downloaded source genome",
	);

	return {
		subtractionId,
		subtractionName: subtraction.name,
		uploadStorageKey,
		uploadIsGzipped,
		paths,
	};
}

/**
 * Locate the upload holding the source genome.
 *
 * A subtraction this workflow is running has no `subtraction_files` rows yet —
 * it writes the first one at finalize — so the upload is the only file it has,
 * and a run that cannot reach it has nothing to do. Both the link and the key
 * are nullable wherever their columns are, and there is no fallback that finds
 * the object: nothing composes a key from row identity on either side.
 */
function resolveUploadStorageKey(subtraction: WorkflowSubtraction): string {
	const { upload } = subtraction;

	if (!upload) {
		throw new Error(`Subtraction ${subtraction.id} names no upload`);
	}

	if (!upload.storageKey) {
		throw new Error(
			`Subtraction ${subtraction.id} upload ${upload.id} records no storage key`,
		);
	}

	return upload.storageKey;
}
