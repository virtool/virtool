/**
 * Building a create_sample run's context.
 *
 * One metadata read and one download per upload, all before step 1. Python
 * resolved fixtures lazily by parameter name, so an upload whose object is
 * missing surfaced at whichever step first touched the file; here it fails
 * before FastQC is spawned.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance.
 */

import { isGzipped } from "@virtool/archive/compression";
import type { WorkflowSampleUpload } from "@virtool/contracts";
import { WorkflowSample } from "@virtool/contracts";
import { type BuildContextInput, downloadToPath } from "@virtool/workflow";
import { type CreateSamplePaths, workPaths } from "./paths";

/** The eagerly resolved data half of a create_sample run's context. */
export type CreateSampleData = {
	/** The sample this run finalizes */
	sampleId: number;

	/** The sample's name, for logging */
	sampleName: string;

	/**
	 * The recorded key each upload was read from, in `sample_uploads.index`
	 * order — the order that decides which becomes `reads_1.fq.gz`.
	 */
	uploadStorageKeys: string[];

	/**
	 * Whether each upload is actually gzipped, positionally.
	 *
	 * The name never says: a user may upload `reads.fastq.gz` that is plain
	 * text, or `reads.fastq` that is not. `finalize` branches on this to decide
	 * whether a read is renamed or compressed — FastQC reads either form, so no
	 * other step asks.
	 */
	uploadsAreGzipped: boolean[];

	paths: CreateSamplePaths;
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

export async function buildCreateSampleContext({
	client,
	job,
	logger,
	storage,
	workPath,
}: BuildContextInput): Promise<CreateSampleData> {
	const sampleId = readIdArg(job.args, "sample_id");

	const sample = await client.request({
		method: "GET",
		path: `/samples/${sampleId}`,
		schema: WorkflowSample,
	});

	const uploads = resolveUploads(sample);
	const paths = workPaths(
		workPath,
		uploads.map((upload) => upload.name),
	);

	logger.info(
		{ sampleId, sampleName: sample.name, uploads: uploads.length },
		"resolved sample metadata",
	);

	// Concurrent because the two are independent objects and a paired sample's
	// reads are the largest thing this pod moves — several gigabytes each, and
	// nothing downstream can start until both have landed.
	//
	// Iterating the paths rather than the uploads keeps the pairing on one
	// index: `workPaths` was handed these names in this order.
	await Promise.all(
		paths.reads.map((read, index) => {
			const upload = uploads[index];

			if (upload === undefined) {
				throw new Error(`No upload for read ${index + 1}`);
			}

			return downloadToPath(storage, upload.storageKey, read.upload);
		}),
	);

	const uploadsAreGzipped = await Promise.all(
		paths.reads.map((read) => isGzipped(read.upload)),
	);

	logger.info({ gzipped: uploadsAreGzipped }, "downloaded uploads");

	return {
		sampleId,
		sampleName: sample.name,
		uploadStorageKeys: uploads.map((upload) => upload.storageKey),
		uploadsAreGzipped,
		paths,
	};
}

/** An upload with the two nullable fields this workflow cannot do without. */
type ResolvedUpload = { name: string; storageKey: string };

/**
 * Locate the uploads holding the raw reads.
 *
 * A sample this workflow is running has no `sample_reads` rows yet — it writes
 * them at finalize — so the uploads are the only files it has, and a run that
 * cannot reach them has nothing to do. Both the name and the key are nullable
 * wherever their columns are, and there is no fallback that finds the object:
 * nothing composes a key from row identity on either side.
 *
 * **Neither `sample.paired` nor `sample.reads` decides the count.** `getSample`
 * derives `paired` from the reads rows, which do not exist until finalize, so a
 * running job is always served `paired: false`. The uploads are the only
 * statement of how many files there are, which is what Python reads too.
 */
function resolveUploads(sample: WorkflowSample): ResolvedUpload[] {
	const { uploads } = sample;

	if (uploads.length !== 1 && uploads.length !== 2) {
		throw new Error(
			`Sample ${sample.id} names ${uploads.length} uploads; expected one or two`,
		);
	}

	const resolved = uploads.map((upload) => resolveUpload(sample.id, upload));

	// Two uploads may legitimately be distinct rows carrying the same filename,
	// and both would download onto one path — leaving the sample finalized with
	// one read stored twice and nothing to say so.
	if (new Set(resolved.map((upload) => upload.name)).size !== resolved.length) {
		throw new Error(
			`Sample ${sample.id} names two uploads with the same filename`,
		);
	}

	return resolved;
}

/**
 * A path segment that is a plain filename.
 *
 * `uploads.name` is whatever the user called the file, and it is joined onto
 * the work path to decide where the bytes land. A name carrying a separator or
 * a `..` segment would write outside `uploads/` — and the rename `finalize`
 * makes only holds within one directory.
 */
const PLAIN_FILENAME = /^[^/\\]+$/;

function resolveUpload(
	sampleId: number,
	upload: WorkflowSampleUpload,
): ResolvedUpload {
	if (!upload.name) {
		throw new Error(`Sample ${sampleId} upload ${upload.id} records no name`);
	}

	if (
		!PLAIN_FILENAME.test(upload.name) ||
		upload.name === "." ||
		upload.name === ".."
	) {
		throw new Error(
			`Sample ${sampleId} upload ${upload.id} has a name that is not a plain filename: ${JSON.stringify(upload.name)}`,
		);
	}

	if (!upload.storageKey) {
		throw new Error(
			`Sample ${sampleId} upload ${upload.id} records no storage key`,
		);
	}

	return { name: upload.name, storageKey: upload.storageKey };
}
