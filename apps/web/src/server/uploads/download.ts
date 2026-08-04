import { getUploadFile } from "@virtool/data/uploads/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db, storage } from "../composition";
import { streamStorageObject, textResponse } from "../http";

/**
 * Serve an upload's bytes, backing `GET /uploads/{uploadId}`.
 *
 * This is a raw route rather than a server function because the client reaches
 * it with a plain `<a href>` — the browser has to see a real response carrying
 * a `Content-Disposition`, which an RPC call cannot produce. The bytes are
 * streamed straight out of storage, so a multi-GB read file never sits in the
 * Node heap.
 *
 * Being a route means no policy middleware runs, so the authorization floor is
 * enforced here. It is a valid session and nothing more: uploads carry no
 * per-row rights, and any signed-in user can already list them. The
 * `upload_file` permission gates *writing* an upload, not reading one back.
 */
export async function handleUploadDownload(
	request: Request,
	uploadId: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	const id = Number(uploadId);

	if (!Number.isInteger(id) || id <= 0) {
		return textResponse("Invalid upload id", 400);
	}

	const file = await getUploadFile(db, id);

	if (file === null) {
		return textResponse("Not found", 404);
	}

	return streamStorageObject(
		storage,
		file.key,
		file.name,
		"application/octet-stream",
	);
}
