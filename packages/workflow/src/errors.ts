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
