/**
 * Base class for every error this package throws.
 *
 * Extends plain `Error` rather than any consumer's error hierarchy, the way
 * `@virtool/storage`'s `StorageError` does — a package this low cannot depend
 * on the packages that read from it.
 */
export class ArchiveError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}

/** A tar archive is malformed, or holds a member that must not be extracted. */
export class TarArchiveError extends ArchiveError {}

/** A tar archive's top-level entry already exists at the restore target. */
export class TarTargetExistsError extends ArchiveError {
	constructor(path: string) {
		super(`${path} already exists`);
	}
}

/**
 * An archive did not carry every member the caller required.
 *
 * Names what was missing rather than what was found: a caller asking for two
 * members by name is describing a layout contract, and the members it did not
 * get are what tell you which contract was broken.
 */
export class TarMemberMissingError extends ArchiveError {
	constructor(missing: string[]) {
		super(`tar archive is missing ${missing.join(", ")}`);
	}
}
