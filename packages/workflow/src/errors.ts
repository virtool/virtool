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

/** Identifies the index artifact an error is about. */
type IndexArtifactRef = {
	id: number;
	path: string;
	storageKey?: string;
};

function describeArtifact(source: IndexArtifactRef): string {
	const key =
		source.storageKey === undefined ? "" : `, storage key ${source.storageKey}`;

	return `index ${source.id} at ${source.path}${key}`;
}

/**
 * The SQLite artifact for an index is absent or could not be opened.
 *
 * Names the index id and the storage key it should have come from, because the
 * two failures behind this — the artifact was never built, or the download
 * silently wrote nothing — are told apart by looking the key up in the bucket.
 */
export class IndexArtifactMissingError extends WorkflowError {
	constructor(source: IndexArtifactRef, options?: ErrorOptions) {
		super(
			`Could not open the SQLite artifact for ${describeArtifact(source)}`,
			options,
		);
	}
}

/**
 * An artifact's `metadata` table names a format this reader does not
 * understand.
 *
 * Reports what was expected alongside what was found. A version bump on
 * Python's side is the likely cause, and the found value is what says which
 * one.
 */
export class IndexArtifactFormatError extends WorkflowError {
	constructor(
		source: IndexArtifactRef,
		expected: string,
		found: string,
		options?: ErrorOptions,
	) {
		super(
			`Expected ${expected} but found ${found} in the SQLite artifact for ${describeArtifact(source)}`,
			options,
		);
	}
}

/** An artifact holds no reference row, so its metadata cannot be read. */
export class IndexReferenceNotFoundError extends WorkflowError {}

/**
 * An artifact holds no sequence for one or more of the requested ids.
 *
 * Python raises rather than returning a partial mapping, and so does this: the
 * caller is resolving alignment targets back to OTUs, and a silently dropped id
 * is a hit missing from the analysis.
 */
export class IndexSequenceNotFoundError extends WorkflowError {
	constructor(sequenceIds: string[]) {
		super(
			`${sequenceIds.length} sequence ids do not exist in the index: ${sequenceIds.slice(0, 10).join(", ")}`,
		);
	}
}

/** An indexed OTU has no isolates, or one of its isolates has no sequences. */
export class IndexOtuIntegrityError extends WorkflowError {}
