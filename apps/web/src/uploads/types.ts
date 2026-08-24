import type { UploadType } from "@virtool/contracts";

/** A file being uploaded from this browser, tracked until the request settles. */
export type UploadInProgress = {
	/* A human-readable reason the upload failed, when `failed` is true */
	error?: string;

	/* Whether the upload failed */
	failed: boolean;

	fileType: UploadType;

	loaded: number;

	localId: string;

	name: string;

	/* Progress of the upload in percentage */
	progress: number;

	/* Size of the file in bytes */
	size: number;
};
