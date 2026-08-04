/**
 * Base error for failed storage operations.
 *
 * Extends `Error` rather than the data layer's `AppError`, so that
 * `@virtool/storage` carries no dependency on `@virtool/data`. The constructor
 * still stamps the subclass name the way `AppError` does, so logs and Sentry
 * keep reporting `StorageKeyNotFoundError` rather than `Error`.
 */
export class StorageError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = new.target.name;
	}
}

/** Thrown when a requested key does not exist in storage. */
export class StorageKeyNotFoundError extends StorageError {
	constructor(readonly key: string) {
		super(key);
	}
}
