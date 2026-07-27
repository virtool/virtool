import { requireAuthenticatedRequest } from "../auth/middleware";
import { db } from "../db/pg";
import { StorageKeyNotFoundError, storage } from "../storage";
import { getSubtractionFileKey } from "./data";

function textResponse(message: string, status: number): Response {
	return new Response(message, { status });
}

// `ReadableStream.from` would do this in one line, but it is absent from the DOM
// lib the app project type-checks against.
function toStream(
	chunks: AsyncIterable<Uint8Array>,
): ReadableStream<Uint8Array> {
	const iterator = chunks[Symbol.asyncIterator]();

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await iterator.next();

			if (done) {
				controller.close();
				return;
			}

			controller.enqueue(value);
		},
		async cancel(reason) {
			// A client that aborts the download mid-stream leaves the backend's
			// request open otherwise.
			await iterator.return?.(reason);
		},
	});
}

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

	// `Content-Length` comes from the object rather than the `subtraction_files`
	// row: the column is nullable and records what the create job wrote, so a
	// stale or null value would truncate the download client-side. Sizing first
	// also settles existence before any header is committed — a row whose bytes
	// are missing becomes a 404 rather than a 200 that dies mid-stream.
	let size: number;

	try {
		size = await storage.size(key);
	} catch (err) {
		if (err instanceof StorageKeyNotFoundError) {
			return textResponse("Not found", 404);
		}
		throw err;
	}

	return new Response(toStream(storage.read(key)), {
		headers: {
			"content-disposition": `attachment; filename=${filename}`,
			"content-length": String(size),
			"content-type": "application/octet-stream",
		},
	});
}
