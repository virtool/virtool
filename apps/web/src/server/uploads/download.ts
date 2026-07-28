import { requireAuthenticatedRequest } from "../auth/middleware";
import { db } from "../db/pg";
import { contentDisposition, textResponse, toStream } from "../http";
import { StorageKeyNotFoundError, storage } from "../storage";
import { getUploadFile } from "./data";

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

	// `Content-Length` comes from the object rather than the `uploads.size`
	// column: the column is nullable and records what the writer reported, so a
	// stale or null value would truncate the download client-side. Sizing first
	// also settles existence before any header is committed — a row whose bytes
	// are missing becomes a 404 rather than a 200 that dies mid-stream.
	let size: number;

	try {
		size = await storage.size(file.key);
	} catch (err) {
		if (err instanceof StorageKeyNotFoundError) {
			return textResponse("Not found", 404);
		}
		throw err;
	}

	return new Response(toStream(storage.read(file.key)), {
		headers: {
			"content-disposition": contentDisposition(file.name),
			"content-length": String(size),
			"content-type": "application/octet-stream",
		},
	});
}
