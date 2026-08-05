import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";

/**
 * Confirm the pod can actually reach the bucket, before it does any work.
 *
 * A workflow pod gets its own object storage identity, and a misconfigured one
 * fails at the first read — which for these workflows is after the reads have
 * already been downloaded and an aligner has run for an hour. Listing a prefix
 * is the cheapest call that exercises credentials, endpoint and bucket name
 * together, so it is worth paying at startup. It reads a single entry and stops:
 * draining the listing would cost a page of requests to learn nothing more.
 *
 * The prefix is only a plausible place to look. Keys are recorded on rows rather
 * than derived, so a subtraction's objects are not guaranteed to live under it —
 * an empty listing still proves the bucket is reachable, which is all this
 * checks.
 */
export async function checkStorageAccess(
	storage: StorageBackend,
	logger: Logger,
	subtractionId: string,
): Promise<void> {
	const prefix = `subtractions/${subtractionId}/`;

	for await (const object of storage.list(prefix)) {
		logger.info({ prefix, key: object.key }, "reached object storage");
		return;
	}

	logger.info({ prefix }, "reached object storage");
}
