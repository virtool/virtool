import {
	getIndexFileKey,
	getIndexReferenceId,
} from "@virtool/data/indexes/data";
import {
	checkReferenceVisibility,
	resolveReferenceActor,
} from "@virtool/data/references/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db, storage } from "../composition";
import { streamStorageObject, textResponse } from "../http";

/**
 * Serve one of a build's artifacts, backing
 * `GET /indexes/{indexId}/files/{filename}`.
 *
 * This is a raw route rather than a server function because the client reaches
 * it with a plain `<a href>` — the browser has to see a real response with a
 * `Content-Disposition`, which an RPC call cannot produce. The bytes are
 * streamed straight out of storage, so a multi-GB Bowtie2 index never sits in
 * the Node heap.
 *
 * Being a route means no policy middleware runs, so the authorization floor is
 * enforced here, and it is more than a valid session: an index is only as
 * visible as the reference it was built from, so the caller must be able to see
 * that reference. Without this any signed-in user could read every reference's
 * builds.
 */
export async function handleIndexFile(
	request: Request,
	indexId: string,
	filename: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	const id = Number(indexId);

	if (!Number.isInteger(id) || id <= 0) {
		return textResponse("Invalid index id", 400);
	}

	const referenceId = await getIndexReferenceId(db, id);

	if (referenceId === null) {
		return textResponse("Not found", 404);
	}

	const actor = await resolveReferenceActor(db, session.userId);

	if (!(await checkReferenceVisibility(db, referenceId, actor))) {
		return textResponse("Forbidden", 403);
	}

	const key = await getIndexFileKey(db, id, filename);

	if (key === null) {
		return textResponse("Not found", 404);
	}

	return streamStorageObject(
		storage,
		key,
		filename,
		"application/octet-stream",
	);
}
