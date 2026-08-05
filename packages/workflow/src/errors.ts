/**
 * Base class for every error this package throws.
 *
 * The subprocess runner and the jobs API client extend this rather than
 * `Error`, so a workflow app can tell a runtime failure from anything else that
 * went wrong inside a step.
 */
export class WorkflowError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}

/** A workflow definition is malformed and could not be validated. */
export class WorkflowDefinitionError extends WorkflowError {}

/**
 * A set of cache params cannot be canonicalized the way Python would.
 *
 * Thrown rather than guessed at, because the failure it prevents is silent: a
 * key that differs from Python's misses every cache and writes a copy under a
 * key nothing will ask for again.
 */
export class CacheParamError extends WorkflowError {}

/**
 * A tar archive is malformed, or holds a member that must not be extracted.
 *
 * Covers Python's two `ValueError` cases in `_check_archive` — an empty archive
 * and one with more than a single top-level entry — as well as the members
 * `filter="data"` refuses.
 */
export class TarArchiveError extends WorkflowError {}

/**
 * A tar archive's top-level entry already exists at the restore target.
 *
 * Python's `FileExistsError`. Kept distinct from {@link TarArchiveError}
 * because it says nothing is wrong with the archive — the destination is
 * occupied.
 */
export class TarTargetExistsError extends WorkflowError {
	constructor(path: string) {
		super(`${path} already exists`);
	}
}
