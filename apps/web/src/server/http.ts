// Helpers shared by the raw routes — the handlers that build a `Response`
// themselves rather than returning a value through the server-function RPC
// layer, because the browser has to see real headers.

import type { StorageBackend } from "@virtool/storage";
import { StorageKeyNotFoundError } from "@virtool/storage";

/**
 * A plain-text response, for the statuses a raw route answers with directly.
 *
 * A route runs outside the server-function context, so it has no `ClientError`
 * to throw and no `setResponseStatus` to call — it returns the status as a
 * response of its own.
 */
export function textResponse(message: string, status: number): Response {
	return new Response(message, { status });
}

// `encodeURIComponent` leaves `'`, `(`, `)`, and `*` unescaped, and none of the
// four is an `attr-char` in RFC 5987's grammar.
function encodeRfc5987(value: string): string {
	return encodeURIComponent(value).replace(
		/['()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

/**
 * A `Content-Disposition` naming a download, safe for a filename built from
 * free text.
 *
 * A name that reaches a filename unvalidated can carry a quote, semicolon, or
 * slash — which a browser misparses out of an unquoted `filename` — or a
 * newline, which makes the `Response` constructor throw. The quoted parameter
 * therefore carries an ASCII fallback with anything unsafe replaced, and an RFC
 * 5987 `filename*` carries the real name whenever the two differ.
 *
 * Every download goes through here even where the filename is provably safe, so
 * that a route built later against a free-text name cannot be the one that
 * discovers the rule.
 */
export function contentDisposition(filename: string): string {
	const fallback = filename.replace(/[^A-Za-z0-9._-]/g, "_");

	if (fallback === filename) {
		return `attachment; filename="${fallback}"`;
	}

	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}

/**
 * Adapt a storage read into the `ReadableStream` a `Response` body takes, so a
 * multi-GB object never sits in the Node heap.
 *
 * `ReadableStream.from` would do this in one line, but it is absent from the
 * DOM lib the app project type-checks against.
 */
export function toStream(
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
 * Stream the object at `key` as a download named `filename`, or a 404 when it
 * has no bytes in storage.
 *
 * Every file download ends this way, so the rule that makes it correct lives
 * here rather than in each handler: `Content-Length` comes from the object and
 * never from the row's size column, which is nullable everywhere and records
 * only what the writing job reported — a stale or null value would truncate the
 * download client-side. Sizing first also settles existence before any header
 * is committed, so a row whose bytes are missing becomes a 404 rather than a
 * 200 that dies mid-stream.
 *
 * The backend is passed in the way `db` is, so this stays testable against
 * `MemoryStorage` without reaching for the process-wide singleton.
 */
export async function streamStorageObject(
	storage: StorageBackend,
	key: string,
	filename: string,
	contentType: string,
): Promise<Response> {
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
			"content-disposition": contentDisposition(filename),
			"content-length": String(size),
			"content-type": contentType,
		},
	});
}
