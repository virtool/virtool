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

/** The response-header overrides and lifetime for a presigned download URL. */
export type PresignDownloadOptions = {
	/** The `Content-Disposition` response header. */
	contentDisposition: string;
	/** The `Content-Type` response header. */
	contentType: string;
	/** The URL lifetime in seconds from now. */
	expiresIn: number;
};

/** The lifetime for a presigned upload URL. */
export type PresignUploadOptions = {
	/**
	 * The URL lifetime in seconds from now. A chunked upload can run for a long
	 * time over hundreds of block writes, so this is measured in hours rather
	 * than the minutes a download redirect lives for.
	 */
	expiresIn: number;
};

/**
 * Streaming object storage, backed by S3 or Azure Blob.
 *
 * Keys are `/`-delimited with no leading slash, e.g.
 * `samples/abc123/reads_1.fq.gz`. There are deliberately no paths or file
 * handles — callers stream bytes. The one exception is {@link presignDownload},
 * an opt-in capability a backend may leave unimplemented.
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

	/**
	 * Mint a short-lived, read-only URL that serves the object at `key` directly
	 * from the storage service, letting a caller redirect a download instead of
	 * streaming the bytes through itself.
	 *
	 * Optional: a backend without a presigning mechanism — `MemoryStorage` —
	 * leaves it undefined, and a caller falls back to streaming. The URL is not
	 * checked against the object existing; a key with no bytes yields a URL that
	 * 404s at the service.
	 */
	presignDownload?(
		key: string,
		options: PresignDownloadOptions,
	): Promise<string>;

	/**
	 * Mint a short-lived, write-only URL a client uploads the object at `key`
	 * to directly, chunk by chunk, instead of streaming the bytes through this
	 * server. The URL grants only create and write on that one key; the caller
	 * appends the block-blob query parameters (`comp=block`, `comp=blocklist`)
	 * itself.
	 *
	 * Optional: only the Azure backend implements it — chunked direct upload is
	 * an Azure Block Blob capability, and `MemoryStorage` and the S3 backend
	 * leave it undefined. A caller falls back to the proxied upload route.
	 */
	presignUpload?(key: string, options: PresignUploadOptions): Promise<string>;
};
