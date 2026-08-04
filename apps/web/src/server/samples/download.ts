import {
	checkSampleRight,
	getSampleReadsFileKey,
	resolveSampleActor,
} from "@virtool/data/samples/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db, storage } from "../composition";
import { streamStorageObject, textResponse } from "../http";

/**
 * Serve one of a sample's read files, backing
 * `GET /samples/{sampleId}/reads/{filename}`.
 *
 * This is a raw route rather than a server function because the client reaches
 * it with a plain `<a href>` — the browser has to see a real response with a
 * `Content-Disposition`, which an RPC call cannot produce. The bytes are
 * streamed straight out of storage, so a multi-GB read file never sits in the
 * Node heap.
 *
 * Being a route means no policy middleware runs, so the authorization floor is
 * enforced here: a valid session, then the read right on the sample. The Python
 * endpoint this replaces checked only the session, which let any signed-in
 * caller download a sample's reads whether or not they could see the sample
 * itself.
 */
export async function handleSampleReads(
	request: Request,
	sampleId: string,
	filename: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	const id = Number(sampleId);

	if (!Number.isInteger(id) || id <= 0) {
		return textResponse("Invalid sample id", 400);
	}

	const actor = await resolveSampleActor(db, session.userId);

	if (!(await checkSampleRight(db, id, actor, "read"))) {
		return textResponse("Forbidden", 403);
	}

	const key = await getSampleReadsFileKey(db, id, filename);

	if (key === null) {
		return textResponse("Not found", 404);
	}

	return streamStorageObject(storage, key, filename, "application/gzip");
}
