import { getSubtractionFileKey } from "@virtool/data/subtraction/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db, storage } from "../composition";
import { streamStorageObject, textResponse } from "../http";

/**
 * Serve a subtraction's FASTA or Bowtie2 file, backing
 * `GET /subtractions/{id}/files/{filename}`.
 *
 * This is a raw route rather than a server function because the client reaches
 * it with a plain `<a href>` — the browser has to see a real response with a
 * `Content-Disposition`, which an RPC call cannot produce. The bytes are
 * streamed straight out of storage, so a multi-GB Bowtie2 index never sits in
 * the Node heap.
 *
 * Being a route means no policy middleware runs, so the authorization floor is
 * enforced here. It is a valid session and nothing more: subtractions carry no
 * per-row rights, and every signed-in user can already read them.
 */
export async function handleSubtractionFile(
	request: Request,
	subtractionId: string,
	filename: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	const id = Number(subtractionId);

	if (!Number.isInteger(id) || id <= 0) {
		return textResponse("Invalid subtraction id", 400);
	}

	const key = await getSubtractionFileKey(db, id, filename);

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
