/** The default chunk size for storage operations in bytes (4 MiB). */
export const STORAGE_CHUNK_SIZE = 4 * 1024 * 1024;

/** A single object listed from storage. */
export type StorageObjectInfo = {
	key: string;
	size: number;
	/**
	 * Semantics differ by backend — the server-side timestamp for a real bucket,
	 * the process clock for MemoryStorage. Never compare it across backends or
	 * rely on it for ordering.
	 */
	lastModified: Date;
};

/**
 * Streaming object storage, backed by S3 or Azure Blob.
 *
 * Keys are `/`-delimited with no leading slash, e.g.
 * `samples/abc123/reads_1.fq.gz`. There are deliberately no paths, file
 * handles, or presigned URLs — callers stream bytes and nothing else.
 */
export type StorageBackend = {
	/** Stream the object at `key`. Throws StorageKeyNotFoundError if absent. */
	read(key: string): AsyncIterable<Uint8Array>;

	/** Write `data` to `key`, creating or overwriting. Returns bytes written. */
	write(key: string, data: AsyncIterable<Uint8Array>): Promise<number>;

	/** Delete the object at `key`. Idempotent — a missing key is not an error. */
	delete(key: string): Promise<void>;

	/** Stream every object whose key starts with `prefix`. */
	list(prefix: string): AsyncIterable<StorageObjectInfo>;

	/** Size of the object at `key`. Throws StorageKeyNotFoundError if absent. */
	size(key: string): Promise<number>;
};
