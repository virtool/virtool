import { UPLOAD_TYPES, type UploadType } from "@virtool/contracts";
import { createUpload } from "@virtool/data/uploads/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { hasPermission } from "../auth/policy";
import { db, storage } from "../composition";
import { logger } from "../logger";

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function* streamBytes(
	stream: ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (value) {
				yield value;
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Handle a streaming file upload, backing the `POST /uploads` route.
 *
 * This is a raw route handler rather than a server function on purpose. The
 * client posts the file with `XMLHttpRequest` so it can report upload progress
 * — `fetch`, and so the generated server-function client, cannot — and read
 * files can run to many gigabytes. The body is read as a stream and handed straight
 * to storage, so a multi-GB file never sits in the Node heap; `name` and `type`
 * travel in the query string, as they do to Python.
 *
 * Being a route means no policy middleware runs, so the authorization floor is
 * enforced here: a valid session, then the `upload_file` permission.
 */
export async function handleUpload(request: Request): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	if (!(await hasPermission(session, "upload_file"))) {
		return new Response("Forbidden", { status: 403 });
	}

	const params = new URL(request.url).searchParams;
	const name = params.get("name") ?? "";
	const type = params.get("type") ?? "";

	if (!name || !UPLOAD_TYPES.includes(type as UploadType)) {
		return jsonResponse(
			{ message: "A valid `name` and `type` are required." },
			422,
		);
	}

	if (!request.body) {
		return jsonResponse({ message: "A file body is required." }, 400);
	}

	logger.info({ name, type, userId: session.userId }, "handling file upload");

	try {
		const upload = await createUpload(db, storage, {
			name,
			type: type as UploadType,
			userId: session.userId,
			body: streamBytes(request.body),
		});

		return jsonResponse(upload, 201);
	} catch (err) {
		logger.error({ err }, "upload failed");
		return jsonResponse({ message: "Upload failed." }, 500);
	}
}
