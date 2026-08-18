/**
 * The index artifact's schema, and the only two ways to open one.
 *
 * A reference index is shipped to a workflow as a single SQLite file, written
 * by this package or by the other implementation still running beside it. This
 * module mirrors that schema so either side can produce a file the other's
 * reader accepts, and validates the `metadata` table so a file that is not what
 * it claims to be is rejected at open rather than halfway through a run.
 *
 * The mirror is of the *schema*, not of SQLAlchemy's DDL text. Python defines
 * its tables explicitly and never reflects them, so only the columns,
 * constraints and indexes have to agree.
 */

import { DatabaseSync } from "node:sqlite";
import { IndexArtifactFormatError, IndexArtifactMissingError } from "./errors";

/**
 * The name of the raw snapshot while a build creates it or a workflow opens it.
 *
 * Versioned in the filename rather than only in the `metadata` table, so an
 * incompatible future artifact cannot be mistaken for this one before it is
 * opened. Mirrors the other implementation's `REFERENCE_SQLITE_FILE_NAME`.
 */
export const REFERENCE_SQLITE_FILE_NAME = "reference-snapshot.v1.sqlite";

/** The name a finished build's gzip-encoded snapshot carries in storage. */
export const REFERENCE_SQLITE_GZIP_FILE_NAME =
	"reference-snapshot.v1.sqlite.gz";

/**
 * The name a workflow gives an artifact it builds itself.
 *
 * Kept distinct from {@link REFERENCE_SQLITE_FILE_NAME} because the two are not
 * interchangeable: a snapshot describes a whole reference, where this one holds
 * whatever survived a step — pathoscope's collapsed reference is missing every
 * isolate `cd-hit-est` dropped. Naming both the same is how one gets uploaded
 * as the other. Mirrors the other implementation's `INDEX_SQLITE_FILE_NAME`.
 */
export const INDEX_SQLITE_FILE_NAME = "index.v1.sqlite";

/** The `format` value every artifact carries in its `metadata` table. */
export const REFERENCE_SQLITE_FORMAT = "virtool-reference-sqlite";

/** The `format_version` value this reader understands. */
export const REFERENCE_SQLITE_FORMAT_VERSION = "1";

/** The `created_by` value this package writes. Python writes the same. */
const REFERENCE_SQLITE_CREATED_BY = "virtool";

const INDEX_SQLITE_DDL = `
CREATE TABLE metadata (
	"key" TEXT NOT NULL,
	value TEXT NOT NULL,
	PRIMARY KEY ("key")
);

CREATE TABLE reference (
	id TEXT NOT NULL,
	created_at TEXT NOT NULL,
	data_type TEXT NOT NULL,
	name TEXT NOT NULL,
	organism TEXT NOT NULL,
	PRIMARY KEY (id)
);

CREATE TABLE otus (
	id TEXT NOT NULL,
	reference_id TEXT,
	abbreviation TEXT NOT NULL,
	name TEXT NOT NULL,
	taxid INTEGER,
	version INTEGER NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(reference_id) REFERENCES reference (id)
);

CREATE TABLE isolates (
	id INTEGER NOT NULL,
	virtool_id TEXT NOT NULL,
	otu_id TEXT NOT NULL,
	source_type TEXT NOT NULL,
	source_name TEXT NOT NULL,
	is_default INTEGER NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (otu_id, virtool_id),
	FOREIGN KEY(otu_id) REFERENCES otus (id)
);

CREATE TABLE otu_schema (
	otu_id TEXT NOT NULL,
	name TEXT NOT NULL,
	molecule TEXT,
	required INTEGER NOT NULL,
	PRIMARY KEY (otu_id, name),
	FOREIGN KEY(otu_id) REFERENCES otus (id)
);

CREATE TABLE sequences (
	id TEXT NOT NULL,
	isolate_id INTEGER NOT NULL,
	accession TEXT NOT NULL,
	definition TEXT NOT NULL,
	host TEXT,
	segment TEXT,
	sequence TEXT NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(isolate_id) REFERENCES isolates (id)
);

CREATE INDEX isolates_otu_id_idx ON isolates (otu_id);
CREATE INDEX sequences_isolate_id_idx ON sequences (isolate_id);
CREATE INDEX sequences_segment_idx ON sequences (segment);
`;

/** Where an artifact came from, for the errors this module throws. */
export type IndexArtifactSource = {
	/** The id of the index the artifact was built for. */
	id: number;

	/** The path the artifact was downloaded or written to. */
	path: string;

	/**
	 * The storage key the artifact was downloaded from.
	 *
	 * Absent for an artifact this process wrote itself — a collapsed reference
	 * has no key until it is uploaded.
	 */
	storageKey?: string;
};

/**
 * Open an artifact read-only, rejecting anything that is not one.
 *
 * There is deliberately no fallback here. An index whose artifact is missing or
 * unreadable cannot be analysed, and a run that quietly degraded to some other
 * source would produce results nothing could reproduce.
 *
 * @throws {IndexArtifactMissingError} when the file is absent or unopenable.
 * @throws {IndexArtifactFormatError} when the `metadata` table is missing,
 * incomplete, or names a format this reader does not understand.
 */
export function openIndexArtifact(source: IndexArtifactSource): DatabaseSync {
	let database: DatabaseSync;

	try {
		database = new DatabaseSync(source.path, { readOnly: true });

		// `DatabaseSync` opens lazily, so a truncated or half-downloaded file
		// constructs cleanly and only fails on the first read. Force that read
		// here, while it is still an open failure rather than a query failure.
		database.prepare("SELECT 1 FROM sqlite_master LIMIT 1").get();
	} catch (error) {
		throw new IndexArtifactMissingError(source, { cause: error });
	}

	try {
		checkIndexArtifactFormat(database, source);
	} catch (error) {
		database.close();

		throw error;
	}

	return database;
}

/**
 * Create an empty artifact at `path`, replacing any file already there.
 *
 * Foreign keys are enforced on the returned handle, as they are on Python's, so
 * a sequence written against an isolate that was never inserted fails at the
 * insert rather than becoming an unreachable row.
 */
export function createIndexArtifactSchema(path: string): DatabaseSync {
	const database = new DatabaseSync(path);

	database.exec("PRAGMA foreign_keys = ON");
	database.exec(INDEX_SQLITE_DDL);

	const insert = database.prepare(
		"INSERT INTO metadata (key, value) VALUES (?, ?)",
	);

	insert.run("format", REFERENCE_SQLITE_FORMAT);
	insert.run("format_version", REFERENCE_SQLITE_FORMAT_VERSION);
	insert.run("created_by", REFERENCE_SQLITE_CREATED_BY);

	return database;
}

function checkIndexArtifactFormat(
	database: DatabaseSync,
	source: IndexArtifactSource,
): void {
	let rows: Array<Record<string, unknown>>;

	try {
		rows = database.prepare(`SELECT "key", value FROM metadata`).all();
	} catch (error) {
		throw new IndexArtifactFormatError(
			source,
			"a readable metadata table",
			"none",
			{ cause: error },
		);
	}

	const metadata = new Map(
		rows.map((row) => [String(row.key), String(row.value)]),
	);

	const expected = [
		["format", REFERENCE_SQLITE_FORMAT],
		["format_version", REFERENCE_SQLITE_FORMAT_VERSION],
	] as const;

	for (const [key, want] of expected) {
		const found = metadata.get(key);

		if (found !== want) {
			throw new IndexArtifactFormatError(
				source,
				`${key}=${want}`,
				found === undefined ? `no ${key}` : `${key}=${found}`,
			);
		}
	}
}
