import { createAzureStorage } from "./azure";
import type { StorageConfig } from "./config";
import { createS3Storage } from "./s3";
import type { StorageBackend } from "./types";

/**
 * Build a backend from storage configuration.
 *
 * The package constructs nothing at import time. A service calls this once in
 * its composition root and passes the backend into data functions.
 */
export function createStorageBackend(config: StorageConfig): StorageBackend {
	if (config.kind === "s3") {
		return createS3Storage(config);
	}

	return createAzureStorage(config);
}
