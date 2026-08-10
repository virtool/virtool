import type { Sample, WorkflowSample } from "@virtool/contracts";
import { FinalizeSampleRequest } from "@virtool/contracts";
import {
	finalizeSample,
	getSample,
	SampleAlreadyFinalizedError,
	SampleNotFoundError,
	SampleNotOwnedError,
} from "@virtool/data/samples/data";
import { requireJobRequest } from "../auth/guard";
import { type FinalizeHandlerDeps, finalizeResource } from "../finalize";
import { jsonError, type ReadHandlerDeps, requireRowId } from "../http";

/** What the sample finalize route needs to serve a request. */
export type SampleHandlerDeps = FinalizeHandlerDeps;

/**
 * The only filenames a sample's reads may be registered under, matching the
 * check Python's `upload_reads` route makes.
 *
 * `sample_reads.name` is a `VARCHAR(13)` upstream, which both of these fit
 * exactly, and Python addresses a reads file by `name` in its download URL.
 */
const FILE_NAMES = ["reads_1.fq.gz", "reads_2.fq.gz"] as const;

/**
 * Narrow a sample to what a workflow reads.
 *
 * The mapping happens here, at the handler boundary, rather than inside
 * `@virtool/data` — `apps/web`'s client feature modules read the same data
 * function, so renaming or dropping a field down there would break them at a
 * distance.
 *
 * Each read carries its recorded `storageKey` and no download URL: the workflow
 * takes the key to the bucket itself.
 */
function toWorkflowSample(sample: Sample): WorkflowSample {
	return {
		id: sample.id,
		libraryType: sample.libraryType,
		name: sample.name,
		paired: sample.paired,
		quality: sample.quality,
		reads: sample.reads.map((read) => ({
			id: read.id,
			name: read.name,
			size: read.size,
			storageKey: read.storageKey,
		})),
	};
}

/**
 * Serve a sample's metadata and the reads files that make it up.
 *
 * Records only. Nothing here reads or writes an object, and the response
 * carries no bytes.
 */
export async function handleGetSample(
	deps: ReadHandlerDeps,
	request: Request,
	sampleIdParam: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const sampleId = requireRowId(sampleIdParam, "Sample not found");

	if (sampleId instanceof Response) {
		return sampleId;
	}

	try {
		return Response.json(toWorkflowSample(await getSample(deps.db, sampleId)));
	} catch (err) {
		if (err instanceof SampleNotFoundError) {
			return jsonError(404, "Sample not found");
		}

		throw err;
	}
}

/**
 * Finalize a sample: record its quality report and the reads the create_sample
 * job produced, and flip it ready.
 *
 * The sample's input uploads are removed as part of this, matching Python — see
 * `finalizeSample` for why the blobs go rather than only the rows.
 *
 * A job may only finalize the sample it produced. That check is the resource
 * counterpart of `requireOwnJob` on the lifecycle routes, and answers the same
 * 403 — but it is `legacy_samples.job_id` that decides it, so it happens inside
 * the same statement that writes, not in a guard here.
 */
export async function handleFinalizeSample(
	deps: SampleHandlerDeps,
	request: Request,
	sampleIdParam: string,
): Promise<Response> {
	return await finalizeResource(deps, request, sampleIdParam, {
		body: FinalizeSampleRequest,
		prefix: (sampleId) => `samples/${sampleId}/`,
		allowedNames: FILE_NAMES,
		notFound: { error: SampleNotFoundError, message: "Sample not found" },
		notOwned: {
			error: SampleNotOwnedError,
			message: "Job did not produce this sample",
		},
		alreadyFinalized: {
			error: SampleAlreadyFinalizedError,
			message: "Sample has already been finalized",
		},
		write: async ({ id: sampleId, jobId, values, files }) => {
			const sample = await finalizeSample(
				deps.db,
				deps.storage,
				deps.logger,
				sampleId,
				jobId,
				{
					quality: values.quality,
					files: files.map((file) => ({
						name: file.name,
						size: file.size,
						storageKey: file.storageKey,
					})),
				},
			);

			deps.logger.info(
				{ jobId, sampleId, files: files.length },
				"finalized sample",
			);

			return sample;
		},
	});
}
