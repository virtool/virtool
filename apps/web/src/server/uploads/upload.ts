import { UPLOAD_TYPES } from "@virtool/contracts";
import {
	UploadIncompleteError,
	UploadNotFoundError,
	UploadSizeMismatchError,
} from "@virtool/data/uploads/data";
import { z } from "zod";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { hasPermission } from "../auth/policy";
import {
	AZURE_MAX_BLOB_SIZE,
	cancelUpload,
	DirectUploadUnavailableError,
	finalizeUpload,
	initializeUpload,
} from "./service";

const initUploadSchema = z.object({
	name: z.string().min(1),
	type: z.enum(UPLOAD_TYPES),
	size: z.number().int().nonnegative().max(AZURE_MAX_BLOB_SIZE),
});

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
	if (err instanceof UploadNotFoundError) {
		return jsonResponse({ message: "Upload not found." }, 404);
	}
	if (err instanceof UploadIncompleteError) {
		return jsonResponse({ message: "Upload is not complete." }, 409);
	}
	if (err instanceof UploadSizeMismatchError) {
		return jsonResponse(
			{ message: "Upload size does not match the declared size." },
			409,
		);
	}
	if (err instanceof DirectUploadUnavailableError) {
		return jsonResponse({ message: err.message }, 503);
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

	const parsed = initUploadSchema.safeParse(input);
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
