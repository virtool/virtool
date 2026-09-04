import {
	AZURE_MAX_BLOCK_COUNT,
	checkUploadSize,
	type UploadType,
} from "@virtool/contracts";
import { getSettings } from "@virtool/data/settings/data";
import {
	cancelPendingUpload,
	createPendingUpload,
	finalizePendingUpload,
} from "@virtool/data/uploads/data";
import { db, storage } from "../composition";
import { config } from "../config";
import { logger } from "../logger";

const UPLOAD_SAS_TTL_SECONDS = 6 * 60 * 60;
const MIN_UPLOAD_BLOCK_SIZE = 16 * 1024 * 1024;

/** Thrown when this deployment cannot issue direct-upload credentials. */
export class DirectUploadUnavailableError extends Error {}

/** Values required to initialize a direct upload. */
export type UploadInit = {
	name: string;
	type: UploadType;
	size: number;
};

/** The instructions for performing a direct block upload. */
export type UploadInstructions = {
	uploadId: number;
	url: string;
	blockSize: number;
	concurrency: number;
};

function getUploadBlockSize(size: number): number {
	const minimumBlockSize = Math.ceil(size / AZURE_MAX_BLOCK_COUNT);
	return Math.max(
		MIN_UPLOAD_BLOCK_SIZE,
		Math.ceil(minimumBlockSize / MIN_UPLOAD_BLOCK_SIZE) * MIN_UPLOAD_BLOCK_SIZE,
	);
}

/** Reserve an upload and issue the instructions for writing it to storage. */
export async function initializeUpload(
	values: UploadInit,
	userId: number,
): Promise<UploadInstructions> {
	const presignUpload = storage.presignUpload;
	if (!config.uploadsChunked || !presignUpload) {
		throw new DirectUploadUnavailableError(
			"Direct uploads are unavailable on this deployment.",
		);
	}

	// Checked before anything is reserved, so an oversized file costs a row and a
	// SAS neither. The configured maximum is read per initialization rather than
	// cached: an administrator lowering it must take effect on the next upload,
	// not on the next restart.
	const { maxUploadSize } = await getSettings(db);
	checkUploadSize(values.size, maxUploadSize);

	const { upload, storageKey } = await createPendingUpload(db, {
		name: values.name,
		type: values.type,
		userId,
		expectedSize: values.size,
	});

	let url: string;
	try {
		url = await presignUpload(storageKey, {
			expiresIn: UPLOAD_SAS_TTL_SECONDS,
		});
	} catch (err) {
		await cancelPendingUpload(db, storage, logger, upload.id, userId).catch(
			() => {},
		);
		throw err;
	}

	return {
		uploadId: upload.id,
		url,
		blockSize: getUploadBlockSize(values.size),
		concurrency: config.uploadsChunkedConcurrency,
	};
}

/** Mark a directly uploaded object ready after validating its stored size. */
export async function finalizeUpload(uploadId: number, userId: number) {
	return finalizePendingUpload(db, storage, uploadId, userId);
}

/** Cancel an unfinished direct upload owned by the caller. */
export async function cancelUpload(
	uploadId: number,
	userId: number,
): Promise<void> {
	await cancelPendingUpload(db, storage, logger, uploadId, userId);
}
