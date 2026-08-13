/** Downloading a large file to disk, for task bodies that install a release. */

import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "@virtool/logger";

/**
 * How long the transfer may go without delivering a byte.
 *
 * **Idle**, not an overall deadline: a healthy link can legitimately spend many
 * minutes on a release archive, and only an idle timer separates slow from dead.
 */
const STALL_TIMEOUT_MS = 60_000;

/** How many times the transfer is attempted before the failure is raised. */
const ATTEMPTS = 4;

/** Base for the exponential backoff between attempts: 1s, 2s, then 4s. */
const BACKOFF_BASE_MS = 1_000;

/** The server answered, and its status says there is nothing to download. */
export class DownloadStatusError extends Error {
	constructor(url: string, status: number) {
		super(`Could not download HMM data: ${url} responded ${status}`);
		this.name = "DownloadStatusError";
	}
}

/** The connection stopped delivering data and was abandoned. */
export class DownloadStalledError extends Error {
	constructor(url: string, ms: number) {
		super(`Could not download HMM data: ${url} stalled for ${ms}ms`);
		this.name = "DownloadStalledError";
	}
}

/** What {@link downloadToFile} accepts alongside its url and path. */
export type DownloadToFileOptions = {
	logger: Logger;
	/** Aborts the request, the transfer, and any backoff waiting to elapse. */
	signal?: AbortSignal;
	/** Called with the running byte count for the current attempt. */
	onProgress?: (received: number) => void;
	/** Overrides for tests. */
	attempts?: number;
	backoffMs?: number;
	stallTimeoutMs?: number;
};

async function attemptDownload(
	url: string,
	path: string,
	options: DownloadToFileOptions,
): Promise<number> {
	const { onProgress, signal, stallTimeoutMs = STALL_TIMEOUT_MS } = options;

	const stalled = new AbortController();

	// Passed to `fetch`, which covers the body as well as the request: aborting
	// destroys the response stream, so the loop below rejects rather than waits.
	const composed = signal
		? AbortSignal.any([signal, stalled.signal])
		: stalled.signal;

	let timer: NodeJS.Timeout | undefined;

	function arm(): void {
		clearTimeout(timer);
		timer = setTimeout(
			() => stalled.abort(new DownloadStalledError(url, stallTimeoutMs)),
			stallTimeoutMs,
		);
	}

	arm();

	try {
		const response = await fetch(url, { signal: composed });

		// Before a byte is read, as Python does. An error page fed to gunzip fails
		// two steps later complaining about compression, not about the 404.
		if (response.status > 399) {
			throw new DownloadStatusError(url, response.status);
		}

		if (response.body === null) {
			throw new DownloadStatusError(url, response.status);
		}

		let received = 0;

		// `createWriteStream` truncates, so a retry rewrites from zero. Nothing
		// resumes a partial transfer: a spliced download would still untar.
		await pipeline(async function* () {
			for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
				arm();

				received += chunk.byteLength;
				onProgress?.(received);

				yield chunk;
			}
		}, createWriteStream(path));

		return received;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Download `url` to `path`, retrying a bounded number of times.
 *
 * Returns the number of bytes written.
 *
 * **Only transport failures are retried.** A 404 on a release URL will be a 404
 * on the next attempt, so retrying it just delays the diagnostic. In-process
 * only; the task row is never requeued. An abort is rethrown untranslated.
 */
export async function downloadToFile(
	url: string,
	path: string,
	options: DownloadToFileOptions,
): Promise<number> {
	const {
		attempts = ATTEMPTS,
		backoffMs = BACKOFF_BASE_MS,
		logger,
		signal,
	} = options;

	let last: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await attemptDownload(url, path, options);
		} catch (err) {
			if (signal?.aborted) {
				throw err;
			}

			if (err instanceof DownloadStatusError) {
				throw err;
			}

			last = err;

			if (attempt < attempts) {
				logger.warn(
					{ attempt, attempts, err, url },
					"download failed, retrying",
				);

				await delay(backoffMs * 2 ** (attempt - 1), undefined, { signal });
			}
		}
	}

	throw last;
}
