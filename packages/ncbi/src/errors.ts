/** Base class for every error raised by the NCBI client. */
export class NcbiError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}

/**
 * Thrown when NCBI could not be reached, or answered with a status this side
 * will not read.
 *
 * Transient by assumption: a caller that retries is doing the right thing.
 * A response that arrived but cannot be turned into a record is
 * {@link NcbiUnreadableError} instead, which no retry settles.
 */
export class NcbiUnreachableError extends NcbiError {}

/**
 * Thrown when a response arrived but this side cannot make records of it —
 * bytes that are not the expected XML or JSON, or a document whose shape the
 * models do not accept.
 *
 * Distinct from {@link NcbiUnreachableError} because it is *not* transient.
 * NCBI will send the same bytes on the next attempt, so re-asking only
 * reproduces the failure.
 */
export class NcbiUnreadableError extends NcbiError {}
