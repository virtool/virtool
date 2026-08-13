/**
 * Base class for every error this package throws.
 *
 * A workflow reads an artifact mid-step and the server writes one mid-task, so
 * both sides need to tell a bad artifact from anything else that went wrong
 * around it.
 */
export class IndexArtifactError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
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
export class IndexArtifactMissingError extends IndexArtifactError {
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
export class IndexArtifactFormatError extends IndexArtifactError {
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
export class IndexReferenceNotFoundError extends IndexArtifactError {}

/**
 * An artifact holds no sequence for one or more of the requested ids.
 *
 * Python raises rather than returning a partial mapping, and so does this: the
 * caller is resolving alignment targets back to OTUs, and a silently dropped id
 * is a hit missing from the analysis.
 */
export class IndexSequenceNotFoundError extends IndexArtifactError {
	constructor(sequenceIds: string[]) {
		super(
			`${sequenceIds.length} sequence ids do not exist in the index: ${sequenceIds.slice(0, 10).join(", ")}`,
		);
	}
}

/** An indexed OTU has no isolates, or one of its isolates has no sequences. */
export class IndexOtuIntegrityError extends IndexArtifactError {}
