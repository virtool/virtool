/**
 * Initiate and track uploads using Zustand.
 */
import { createRandomString } from "@app/utils";
import type { Upload, UploadType } from "@virtool/contracts";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { UploadInProgress } from "./types";

const SAMPLE_INTERVAL_MS = 500;

/** How long a completed upload lingers in the list before it is removed. */
const COMPLETED_LINGER_MS = 4000;

type UploaderState = {
	/** The ID of the interval that tracks the upload progress. */
	intervalId?: number;

	/** Whether the detail card is shown. The nav indicator toggles it. */
	open: boolean;

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

	/** Remove every completed upload from the list. */
	clearCompleted: () => void;

	/** Remove an upload from the list of uploads. */
	removeUpload: (localId: string) => void;

	/** Return a failed upload to a fresh, in-progress state so it can retry. */
	resetUpload: (localId: string) => void;

	/** Mark an upload as finished successfully, awaiting dismissal. */
	setComplete: (localId: string) => void;

	/** Set an upload as failed, recording why. */
	setFailure: (localId: string, error: string) => void;

	/** Show or hide the detail card. */
	setOpen: (open: boolean) => void;

	/** Set the progress of an upload. */
	setProgress: (localId: string, loaded: number, progress: number) => void;
};

/**
 * Zustand store to track the current uploads and their progress.
 */
export const useUploaderStore = create<UploaderState>()(
	subscribeWithSelector((set) => ({
		intervalId: 0,
		open: false,
		uploads: [],
		remaining: 0,
		samples: [],
		speed: 0,
		addUpload: (upload) =>
			set((state) => ({ uploads: [...state.uploads, upload] })),
		clearCompleted: () =>
			set((state) => ({
				uploads: state.uploads.filter((upload) => !upload.completed),
			})),
		removeUpload: (localId) =>
			set((state) => {
				const uploads = state.uploads.filter(
					(upload) => upload.localId !== localId,
				);
				return uploads.length === 0
					? { uploads, remaining: 0, speed: 0 }
					: { uploads };
			}),
		resetUpload: (localId) =>
			set((state) => ({
				uploads: state.uploads.map((upload) =>
					upload.localId === localId
						? {
								...upload,
								completed: false,
								error: undefined,
								failed: false,
								loaded: 0,
								progress: 0,
							}
						: upload,
				),
			})),
		setComplete: (localId) =>
			set((state) => ({
				uploads: state.uploads.map((upload) =>
					upload.localId === localId
						? {
								...upload,
								completed: true,
								loaded: upload.size,
								progress: 100,
							}
						: upload,
				),
			})),
		setOpen: (open) => set({ open }),
		setFailure: (localId, error) =>
			set((state) => ({
				uploads: state.uploads.map((upload) =>
					upload.localId === localId
						? { ...upload, error, failed: true }
						: upload,
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
	signal?: AbortSignal,
): Promise<Upload> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const query = `?name=${encodeURIComponent(name)}&type=${fileType}`;
		xhr.open("POST", `/uploads${query}`);

		signal?.addEventListener("abort", () => xhr.abort());

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
 * The file and abort controller for each tracked upload, kept out of the store
 * so its state stays serialisable. An entry lives until the upload is removed:
 * a failed upload keeps its entry so `retryUpload` can re-post the same file.
 */
const tracked = new Map<
	string,
	{ controller: AbortController; file: File; fileType: UploadType }
>();

/**
 * Post one tracked file, wiring its progress and outcome into the store.
 *
 * An aborted request is left to `cancelUpload`, which has already removed the
 * upload; any other rejection surfaces its message on the failed upload.
 */
function runUpload(localId: string, file: File, fileType: UploadType): void {
	const controller = new AbortController();
	tracked.set(localId, { controller, file, fileType });

	postUpload(
		file,
		file.name,
		fileType,
		({ loaded, percent }) => {
			useUploaderStore.getState().setProgress(localId, loaded, percent);
		},
		controller.signal,
	)
		.then(() => {
			tracked.delete(localId);
			useUploaderStore.getState().setComplete(localId);
			window.setTimeout(() => {
				useUploaderStore.getState().removeUpload(localId);
			}, COMPLETED_LINGER_MS);
		})
		.catch((error: Error) => {
			if (controller.signal.aborted) {
				return;
			}
			useUploaderStore.getState().setFailure(localId, error.message);
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

	useUploaderStore.getState().clearCompleted();

	const active = useUploaderStore
		.getState()
		.uploads.filter((upload) => !upload.completed && !upload.failed);

	if (active.length === 0) {
		useUploaderStore.setState({ samples: [] });
	}

	useUploaderStore.getState().addUpload({
		completed: false,
		failed: false,
		fileType,
		loaded: 0,
		localId,
		name,
		progress: 0,
		size,
	});

	runUpload(localId, file, fileType);
}

/**
 * Cancel an in-progress upload, or remove a failed one. Aborting a request that
 * has already settled is a harmless no-op.
 */
export function cancelUpload(localId: string): void {
	tracked.get(localId)?.controller.abort();
	tracked.delete(localId);
	useUploaderStore.getState().removeUpload(localId);
}

/** Cancel every tracked upload, aborting those still in flight. */
export function cancelAll(): void {
	for (const { localId } of useUploaderStore.getState().uploads) {
		cancelUpload(localId);
	}
}

/** Show or hide the upload detail card. */
export function setOpen(open: boolean): void {
	useUploaderStore.getState().setOpen(open);
}

/** Toggle the upload detail card between shown and hidden. */
export function toggleOpen(): void {
	const { open, setOpen } = useUploaderStore.getState();
	setOpen(!open);
}

/**
 * Retry a failed upload, re-posting the same file in place.
 */
export function retryUpload(localId: string): void {
	const entry = tracked.get(localId);

	if (entry === undefined) {
		return;
	}

	useUploaderStore.getState().resetUpload(localId);
	runUpload(localId, entry.file, entry.fileType);
}

/**
 * Recompute the aggregate upload speed and remaining time from byte samples.
 *
 * Runs once per {@link SAMPLE_INTERVAL_MS} while uploads are in flight.
 */
export function watchUploadTiming(): void {
	const { getState, setState } = useUploaderStore;
	const { samples, uploads } = getState();

	const active = uploads.filter(
		(upload) => !upload.completed && !upload.failed,
	);

	if (
		active.length === 0 ||
		active.every((upload) => upload.progress === 100)
	) {
		return;
	}

	const { loaded, total } = active.reduce(
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

	if (
		newSamples.length > 1 &&
		last !== undefined &&
		first !== undefined &&
		last > first
	) {
		// Samples are taken once per interval, so the span they cover is one
		// interval shorter than the sample count.
		const elapsedSeconds =
			(newSamples.length - 1) * (SAMPLE_INTERVAL_MS / 1000);
		speed = (last - first) / elapsedSeconds;
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

		if (uploadsLength === 0) {
			window.clearInterval(getState().intervalId);
			setState({
				intervalId: 0,
				open: false,
				remaining: 0,
				samples: [],
				speed: 0,
			});
		} else if (previousUploadsLength === 0) {
			const intervalId = window.setInterval(
				watchUploadTiming,
				SAMPLE_INTERVAL_MS,
			);

			setState({ intervalId, open: true });
		}
	},
);
