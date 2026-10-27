import { requireAuthenticatedRequest } from "../auth/middleware";
import { hasPermission } from "../auth/policy";
import { getUploadErrorResponse } from "./errors";
import {
	cancelUpload,
	finalizeUpload,
	initializeUpload,
	uploadInitSchema,
} from "./service";

function jsonResponse(body: unknown, status: number): Response {
	return Response.json(body, { status });
}

async function authorize(request: Request) {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}
	if (!(await hasPermission(session, "upload_file"))) {
		return new Response("Forbidden", { status: 403 });
	}
	return session;
}

function uploadErrorResponse(err: unknown): Response | null {
	const response = getUploadErrorResponse(err);
	if (response) {
		return jsonResponse({ message: response.message }, response.status);
	}
	return null;
}

/** Initialize a direct upload for `POST /api/v1/uploads`. */
export async function handleUploadInitialize(
	request: Request,
): Promise<Response> {
	const session = await authorize(request);
	if (session instanceof Response) {
		return session;
	}

	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return jsonResponse({ message: "A JSON body is required." }, 400);
	}

	const parsed = uploadInitSchema.safeParse(input);
	if (!parsed.success) {
		return jsonResponse({ message: "Invalid upload initialization." }, 422);
	}

	try {
		return jsonResponse(
			await initializeUpload(parsed.data, session.userId),
			201,
		);
	} catch (err) {
		const response = uploadErrorResponse(err);
		if (response) {
			return response;
		}
		throw err;
	}
}

/** Finalize a direct upload for `POST /api/v1/uploads/{id}/finalize`. */
export async function handleUploadFinalize(
	request: Request,
	uploadId: string,
): Promise<Response> {
	const session = await authorize(request);
	if (session instanceof Response) {
		return session;
	}
	const id = Number(uploadId);
	if (!Number.isInteger(id) || id <= 0) {
		return jsonResponse({ message: "Invalid upload id." }, 400);
	}
	try {
		return jsonResponse(await finalizeUpload(id, session.userId), 200);
	} catch (err) {
		const response = uploadErrorResponse(err);
		if (response) {
			return response;
		}
		throw err;
	}
}

/** Cancel a direct upload for `DELETE /api/v1/uploads/{id}`. */
export async function handleUploadCancel(
	request: Request,
	uploadId: string,
): Promise<Response> {
	const session = await authorize(request);
	if (session instanceof Response) {
		return session;
	}
	const id = Number(uploadId);
	if (!Number.isInteger(id) || id <= 0) {
		return jsonResponse({ message: "Invalid upload id." }, 400);
	}
	try {
		await cancelUpload(id, session.userId);
		return new Response(null, { status: 204 });
	} catch (err) {
		const response = uploadErrorResponse(err);
		if (response) {
			return response;
		}
		throw err;
	}
}
