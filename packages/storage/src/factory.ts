import { createAzureStorage } from "./azure";
import type { StorageConfig } from "./config";
import { createS3Storage } from "./s3";
import type { StorageBackend } from "./types";

/**
 * Build a backend from storage configuration. Kept apart from `index.ts` so a
 * caller can construct a backend — the integration tests, say — without
 * importing the module-scope config parse and the process-wide singleton.
 */
export function createStorageBackend(config: StorageConfig): StorageBackend {
	if (config.kind === "s3") {
		return createS3Storage(config);
	}

	return createAzureStorage(config);
}
