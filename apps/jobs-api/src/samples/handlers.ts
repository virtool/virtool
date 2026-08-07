import type { Sample, WorkflowSample } from "@virtool/contracts";
import { FinalizeSampleRequest } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import {
	finalizeSample,
	getSample,
	SampleAlreadyFinalizedError,
	SampleNotFoundError,
} from "@virtool/data/samples/data";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { requireJobRequest } from "../auth/guard";
import { jsonError, parseRowId, type ReadHandlerDeps } from "../http";
import { checkManifest, measureManifest } from "../manifest";

/** What the sample handlers need to serve a request. */
export type SampleHandlerDeps = {
	db: Db;
	storage: StorageBackend;
	logger: Logger;
};

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

	const sampleId = parseRowId(sampleIdParam);

	if (sampleId === null) {
		return jsonError(404, "Sample not found");
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
 */
export async function handleFinalizeSample(
	deps: SampleHandlerDeps,
	request: Request,
	sampleIdParam: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const sampleId = parseRowId(sampleIdParam);

	if (sampleId === null) {
		return jsonError(404, "Sample not found");
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return jsonError(400, "Malformed body");
	}

	const parsed = FinalizeSampleRequest.safeParse(body);

	if (!parsed.success) {
		return Response.json(
			{ message: "Invalid body", errors: parsed.error.issues },
			{ status: 400 },
		);
	}

	const { quality, files } = parsed.data;

	const invalid = checkManifest(files, `samples/${sampleId}/`, FILE_NAMES);

	if (invalid) {
		return jsonError(400, invalid);
	}

	const measured = await measureManifest(deps.storage, files);

	if (measured === null) {
		return jsonError(400, "A manifest entry names no stored object");
	}

	try {
		const sample = await finalizeSample(
			deps.db,
			deps.storage,
			deps.logger,
			sampleId,
			{
				quality,
				files: measured.map((file) => ({
					name: file.name,
					size: file.size,
					storageKey: file.storageKey,
				})),
			},
		);

		deps.logger.info(
			{ jobId: principal.jobId, sampleId, files: files.length },
			"finalized sample",
		);

		return Response.json(sample);
	} catch (err) {
		if (err instanceof SampleNotFoundError) {
			return jsonError(404, "Sample not found");
		}

		if (err instanceof SampleAlreadyFinalizedError) {
			return jsonError(409, "Sample has already been finalized");
		}

		throw err;
	}
}
