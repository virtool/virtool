/**
 * Initiate and track uploads using Zustand.
 */
import { createRandomString } from "@app/utils";
import type { Upload, UploadType } from "@virtool/contracts";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { UploadInProgress } from "./types";

type UploaderState = {
	/** The ID of the interval that tracks the upload progress. */
	intervalId?: number;

	/** The list of uploads. */
	uploads: UploadInProgress[];

	/** The remaining time for all uploads in seconds. */
	remaining: number;

	/** The samples of the loaded bytes for the uploads. Used to estimate speed and time remaining. */
	samples: number[];

	/** The current estimated upload speed in bytes per second. */
	speed: number;

	/** Add an upload to the list of uploads. */
	addUpload: (file: UploadInProgress) => void;

	/** Remove an upload from the list of uploads. */
	removeUpload: (localId: string) => void;

	/** Set an upload as failed. */
	setFailure: (localId: string) => void;

	/** Set the progress of an upload. */
	setProgress: (localId: string, loaded: number, progress: number) => void;
};

/**
 * Zustand store to track the current uploads and their progress.
 */
export const useUploaderStore = create<UploaderState>()(
	subscribeWithSelector((set) => ({
		intervalId: 0,
		uploads: [],
		remaining: 0,
		samples: [],
		speed: 0,
		addUpload: (upload) =>
			set((state) => ({ uploads: [...state.uploads, upload] })),
		removeUpload: (localId) =>
			set((state) => {
				const uploads = state.uploads.filter(
					(upload) => upload.localId !== localId,
				);
				return uploads.length === 0
					? { uploads, remaining: 0, speed: 0 }
					: { uploads };
			}),
		setFailure: (localId) =>
			set((state) => ({
				uploads: state.uploads.map((upload) =>
					upload.localId === localId ? { ...upload, failed: true } : upload,
				),
			})),
		setProgress: (localId, loaded, progress) =>
			set((state) => ({
				uploads: state.uploads.map((upload) =>
					upload.localId === localId ? { ...upload, loaded, progress } : upload,
				),
			})),
	})),
);

/** Progress of an in-flight upload, reported as bytes and a whole percentage. */
export type UploadProgress = {
	loaded: number;
	total: number;
	percent: number;
};

/**
 * Read a human-readable error message from a failed upload response.
 *
 * The route returns a JSON `{ message }` body for its 4xx/5xx responses, so
 * surface that when it parses; otherwise fall back to the status code (e.g. the
 * plain-text `Forbidden` a 403 returns).
 */
function readErrorMessage(xhr: XMLHttpRequest): string {
	try {
		const body = JSON.parse(xhr.responseText) as { message?: unknown };
		if (typeof body.message === "string") {
			return body.message;
		}
	} catch {
		// Non-JSON body; fall through to the status-code message.
	}

	return `Upload failed with status ${xhr.status}.`;
}

/**
 * Post a file to the `POST /uploads` route, reporting upload progress.
 *
 * The file is posted with `XMLHttpRequest` rather than `fetch`, because `fetch`
 * cannot report upload progress and read files can run to many gigabytes. The
 * browser streams the raw `File` body from disk (never buffering it in JS), and
 * the route reads it as a stream too, so nothing large sits in memory on either
 * side. `name` and `type` travel in the query string.
 */
export function postUpload(
	file: File,
	name: string,
	fileType: UploadType,
	onProgress?: (progress: UploadProgress) => void,
): Promise<Upload> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const query = `?name=${encodeURIComponent(name)}&type=${fileType}`;
		xhr.open("POST", `/uploads${query}`);

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable && onProgress) {
				onProgress({
					loaded: event.loaded,
					total: event.total,
					percent: Math.round((event.loaded / event.total) * 100),
				});
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(JSON.parse(xhr.responseText) as Upload);
			} else {
				reject(new Error(readErrorMessage(xhr)));
			}
		});
		xhr.addEventListener("error", () => reject(new Error("Upload failed.")));
		xhr.addEventListener("abort", () => reject(new Error("Upload aborted.")));

		xhr.send(file);
	});
}

/**
 * Upload a file to the Virtool server.
 *
 * This function ties in with the Zustand store `useUploaderStore` to track the progress of the upload.
 */
export function upload(file: File, fileType: UploadType) {
	const { name, size } = file;
	const localId = createRandomString();

	useUploaderStore.getState().addUpload({
		failed: false,
		fileType,
		loaded: 0,
		localId,
		name,
		progress: 0,
		size,
	});

	postUpload(file, name, fileType, ({ loaded, percent }) => {
		useUploaderStore.getState().setProgress(localId, loaded, percent);
	})
		.then(() => useUploaderStore.getState().removeUpload(localId))
		.catch(() => useUploaderStore.getState().setFailure(localId));
}

/**
 * Update the remaining time and speed of the uploads every 500 milliseconds.
 * Poll the uploads to calculate the remaining time and speed of the uploads.
 */
function watchUploadTiming(): void {
	const { getState, setState } = useUploaderStore;
	const { samples, uploads } = getState();

	if (uploads.every((upload) => upload.progress === 100)) {
		return;
	}

	const { loaded, total } = uploads.reduce(
		(acc, upload) => ({
			loaded: acc.loaded + upload.loaded,
			total: acc.total + upload.size,
		}),
		{ loaded: 0, total: 0 },
	);

	const newSamples = [...samples.slice(-9), loaded];

	const last = newSamples[newSamples.length - 1];
	const first = newSamples[0];

	let speed: number;

	if (newSamples.length > 1 && last !== undefined && first !== undefined) {
		speed = Math.abs(last - first) / newSamples.length;
	} else {
		speed = 0;
	}

	setState({
		remaining: speed > 0 ? (total - loaded) / speed : 0,
		samples: newSamples,
		speed,
	});
}

useUploaderStore.subscribe(
	(state) => state.uploads.length,
	(uploadsLength, previousUploadsLength) => {
		const { getState, setState } = useUploaderStore;

		if (uploadsLength === 0 && previousUploadsLength > 0) {
			window.clearInterval(getState().intervalId);
			setState({ intervalId: 0, remaining: 0, samples: [], speed: 0 });
		} else {
			const intervalId = window.setInterval(() => {
				watchUploadTiming();
			}, 500);

			setState({ intervalId });
		}
	},
);
