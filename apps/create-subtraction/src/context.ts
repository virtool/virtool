/**
 * Building a create_subtraction run's context.
 *
 * One metadata read and one download, both before step 1. Python resolved
 * fixtures lazily by parameter name, so an upload whose object is missing
 * surfaced at whichever step first touched the file; here it fails before any
 * work is done.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance.
 */

import { WorkflowSubtraction } from "@virtool/contracts";
import {
	type BuildContextInput,
	downloadToPath,
	isGzipped,
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

/**
 * Read a job argument naming a resource.
 *
 * **Every arg value is a stringified id** — `args` is recomposed by the jobs API
 * from the resources that reference the job rather than read from a column, and
 * `Job.args` types it `Record<string, string>`. So this parses rather than
 * type-checks, and rejects anything `Number` would quietly accept: an empty
 * string is `0`, and a trailing-garbage id would silently address a different
 * row.
 */
function readIdArg(args: Record<string, string>, name: string): number {
	const raw = args[name];

	if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
		throw new Error(
			`Job argument ${name} must be a positive integer id, got ${JSON.stringify(raw)}`,
		);
	}

	return Number(raw);
}

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
