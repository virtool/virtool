import { UploadTooLargeError } from "@virtool/contracts";
import {
	UploadIncompleteError,
	UploadNotFoundError,
	UploadReservedError,
	UploadSizeMismatchError,
} from "@virtool/data/uploads/data";
import { DirectUploadUnavailableError } from "./service";

/** The status and message an expected upload failure is sent to the client as. */
type UploadErrorResponse = {
	status: number;
	message: string;
};

/**
 * Map an expected upload failure to its response, or return `null` for an
 * unexpected error.
 *
 * Shared by the server functions and the REST routes so both transports answer
 * the same failure the same way.
 */
export function getUploadErrorResponse(
	err: unknown,
): UploadErrorResponse | null {
	if (err instanceof UploadNotFoundError) {
		return { status: 404, message: "Upload not found." };
	}
	if (err instanceof UploadReservedError) {
		return { status: 409, message: "Upload is reserved and in use." };
	}
	if (err instanceof UploadIncompleteError) {
		return { status: 409, message: "Upload is not complete." };
	}
	if (err instanceof UploadSizeMismatchError) {
		return {
			status: 409,
			message: "Upload size does not match the declared size.",
		};
	}
	if (err instanceof UploadTooLargeError) {
		return { status: 413, message: err.message };
	}
	if (err instanceof DirectUploadUnavailableError) {
		return { status: 503, message: err.message };
	}
	return null;
}
