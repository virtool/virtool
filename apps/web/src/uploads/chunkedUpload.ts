/**
 * Upload a file directly to blob storage in blocks, bypassing this server.
 *
 * The server mints a write SAS for one blob key; the browser then PUTs the file
 * to that URL as a sequence of Azure "Put Block" calls and commits them with a
 * "Put Block List", so a multi-GB upload is hundreds of short requests rather
 * than one 40-minute stream. Front Door's idle timeout never trips, and no
 * bytes pass through the Node process. The server is told when the blocks are
 * committed so it can record the upload as ready.
 *
 * The decision to take this path, and the SAS itself, come from `initUploadFn`;
 * this module runs the block upload the server handed it. Blocks are PUT with
 * `XMLHttpRequest`, not `fetch`, for the same reason `postUpload` is: only XHR
 * reports upload progress, and the file is sliced so each request streams a
 * `Blob` from disk without buffering it in JS.
 */
import {
	cancelChunkedUploadFn,
	finalizeChunkedUploadFn,
} from "@server/uploads/functions";
import type { Upload } from "@virtool/contracts";
import type { UploadProgress } from "./uploader";

/** What `initUploadFn` hands back to run a chunked upload. */
export type ChunkedInit = {
	uploadId: number;
	url: string;
	blockSize: number;
};

/** How many blocks are PUT at once. */
const BLOCK_CONCURRENCY = 4;

/** How many times a single block PUT is retried before the upload fails. */
const BLOCK_MAX_ATTEMPTS = 3;

/**
 * The block id for the block at `index`.
 *
 * Azure requires every block id of a blob to be the same length before base64
 * encoding, so the index is zero-padded to a fixed width. Six digits allow
 * enough blocks to cover any file this accepts.
 */
function blockId(index: number): string {
	return btoa(String(index).padStart(6, "0"));
}

/** The Put Block List body committing `count` blocks in order. */
function blockListBody(count: number): string {
	const blocks = Array.from(
		{ length: count },
		(_, index) => `<Latest>${blockId(index)}</Latest>`,
	).join("");

	return `<?xml version="1.0" encoding="utf-8"?><BlockList>${blocks}</BlockList>`;
}

/**
 * PUT one block of the blob, reporting how many of its bytes have been sent.
 *
 * Retries a network error or a 5xx a few times, since an upload is hundreds of
 * these and a single transient failure should not sink it. A 4xx is fatal — the
 * SAS has lapsed or the request is malformed — so it is not retried.
 */
function putBlock(
	url: string,
	index: number,
	body: Blob,
	onBlockProgress: (loaded: number) => void,
	signal: AbortSignal | undefined,
	attempt = 1,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException("Upload aborted.", "AbortError"));
			return;
		}

		const xhr = new XMLHttpRequest();
		const blockUrl = `${url}&comp=block&blockid=${encodeURIComponent(blockId(index))}`;
		xhr.open("PUT", blockUrl);

		function onAbort() {
			xhr.abort();
		}
		signal?.addEventListener("abort", onAbort);

		function settle(action: () => void) {
			signal?.removeEventListener("abort", onAbort);
			action();
		}

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable) {
				onBlockProgress(event.loaded);
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				settle(() => {
					onBlockProgress(body.size);
					resolve();
				});
			} else if (xhr.status >= 500 && attempt < BLOCK_MAX_ATTEMPTS) {
				settle(() =>
					resolve(
						putBlock(url, index, body, onBlockProgress, signal, attempt + 1),
					),
				);
			} else {
				settle(() => reject(new Error(`Block upload failed (${xhr.status}).`)));
			}
		});

		xhr.addEventListener("error", () => {
			if (attempt < BLOCK_MAX_ATTEMPTS) {
				settle(() =>
					resolve(
						putBlock(url, index, body, onBlockProgress, signal, attempt + 1),
					),
				);
			} else {
				settle(() => reject(new Error("Block upload failed.")));
			}
		});

		xhr.addEventListener("abort", () =>
			settle(() => reject(new DOMException("Upload aborted.", "AbortError"))),
		);

		xhr.send(body);
	});
}

/** Commit the staged blocks into the finished blob. */
function putBlockList(
	url: string,
	count: number,
	contentType: string,
	signal: AbortSignal | undefined,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException("Upload aborted.", "AbortError"));
			return;
		}

		const xhr = new XMLHttpRequest();
		xhr.open("PUT", `${url}&comp=blocklist`);
		xhr.setRequestHeader("content-type", "application/xml");
		xhr.setRequestHeader(
			"x-ms-blob-content-type",
			contentType || "application/octet-stream",
		);

		function onAbort() {
			xhr.abort();
		}
		signal?.addEventListener("abort", onAbort);

		function settle(action: () => void) {
			signal?.removeEventListener("abort", onAbort);
			action();
		}

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				settle(resolve);
			} else {
				settle(() =>
					reject(new Error(`Commit failed with status ${xhr.status}.`)),
				);
			}
		});
		xhr.addEventListener("error", () =>
			settle(() => reject(new Error("Commit failed."))),
		);
		xhr.addEventListener("abort", () =>
			settle(() => reject(new DOMException("Upload aborted.", "AbortError"))),
		);

		xhr.send(blockListBody(count));
	});
}

/**
 * Stage every block, PUTting up to {@link BLOCK_CONCURRENCY} at once and summing
 * their progress across the whole file.
 */
async function stageBlocks(
	url: string,
	file: File,
	blockSize: number,
	blockCount: number,
	onProgress: ((progress: UploadProgress) => void) | undefined,
	signal: AbortSignal | undefined,
): Promise<void> {
	const loaded = new Array<number>(blockCount).fill(0);

	function report(index: number, value: number) {
		loaded[index] = value;
		if (onProgress) {
			const total = loaded.reduce((sum, bytes) => sum + bytes, 0);
			onProgress({
				loaded: total,
				total: file.size,
				percent: file.size > 0 ? Math.round((total / file.size) * 100) : 100,
			});
		}
	}

	let next = 0;

	async function worker() {
		while (true) {
			const index = next++;
			if (index >= blockCount) {
				return;
			}

			const start = index * blockSize;
			const body = file.slice(start, Math.min(start + blockSize, file.size));

			await putBlock(url, index, body, (value) => report(index, value), signal);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(BLOCK_CONCURRENCY, blockCount) }, worker),
	);
}

/**
 * Run the chunked upload the server reserved, returning the finished upload.
 *
 * On any failure — including an abort — the reserved upload is cancelled
 * best-effort so it does not linger for the reaper, then the original error is
 * surfaced.
 */
export async function uploadBlocks(
	init: ChunkedInit,
	file: File,
	onProgress?: (progress: UploadProgress) => void,
	signal?: AbortSignal,
): Promise<Upload> {
	const { uploadId, url, blockSize } = init;

	try {
		const blockCount = Math.ceil(file.size / blockSize);

		await stageBlocks(url, file, blockSize, blockCount, onProgress, signal);
		await putBlockList(url, blockCount, file.type, signal);

		return await finalizeChunkedUploadFn({ data: { id: uploadId } });
	} catch (error) {
		// Drop the reservation so it is not left for the reaper. The upload has
		// already failed, so a failed cancel changes nothing worth surfacing.
		await cancelChunkedUploadFn({ data: { id: uploadId } }).catch(() => {});
		throw error;
	}
}
