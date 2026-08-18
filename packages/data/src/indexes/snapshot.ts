// The `reference-snapshot.v1.sqlite.gz` artifact a finished build publishes.
//
// A build produces two files describing the same OTUs: the gzipped JSON in
// `artifact.ts`, and this one. Only this one is analysable — a real reference is
// hundreds of megabytes of JSON, past the maximum string length a `JSON.parse`
// could return, so a workflow reads the snapshot and nothing else.
//
// The rows are written through `@virtool/sqlite`, which owns the format. What
// lives here is the mapping from a patched OTU document — verbatim legacy Mongo,
// `_id` keys and all — onto the shape that writer takes.

import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compressFile } from "@virtool/archive/compression";
import {
	createIndexArtifact,
	type IndexOtu,
	type IndexOtuIsolate,
	type IndexOtuSchemaItem,
	type IndexOtuSequence,
	type IndexReference,
	REFERENCE_SQLITE_FILE_NAME,
	REFERENCE_SQLITE_GZIP_FILE_NAME,
} from "@virtool/sqlite";
import type { StorageBackend } from "@virtool/storage";
import { AppError } from "../errors";

/**
 * Thrown when a patched OTU document is not shaped like one.
 *
 * The manifest already proved the OTU existed at this version, so a document
 * missing a field every OTU carries is corrupted history rather than a routine
 * miss. The build fails rather than publishing a snapshot with a hole in it.
 */
export class IndexSnapshotOtuError extends AppError {}

/**
 * Build the snapshot and upload it, returning the byte count that was stored.
 *
 * The artifact is assembled on local disk because it is written out of order —
 * an isolate's rowid is only known once it is inserted — so there is no version
 * of this that streams into the bucket. The pod's disk holds the raw prerequisite
 * and gzip output during compression, where its heap would not: the rows go in
 * as they arrive and are never collected. Only the gzip output is uploaded.
 */
export async function writeIndexSnapshot(
	storage: StorageBackend,
	key: string,
	reference: IndexReference,
	otus: AsyncIterable<IndexOtu>,
): Promise<number> {
	const directory = await mkdtemp(join(tmpdir(), "virtool-index-"));

	try {
		const path = join(directory, REFERENCE_SQLITE_FILE_NAME);
		const gzipPath = join(directory, REFERENCE_SQLITE_GZIP_FILE_NAME);

		await createIndexArtifact(path, reference, otus);
		await compressFile(path, gzipPath);

		return await storage.write(key, createReadStream(gzipPath));
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
}

/**
 * Map a patched OTU document onto the shape the artifact writer takes.
 *
 * Every field the snapshot carries is one the reader hands back to a workflow,
 * so a missing one is rejected here rather than stored as null and read back as
 * a hole. The three fields with defaults — `abbreviation`, `taxid` and a schema
 * item's `required` — are the three a legitimate document may legitimately
 * omit.
 */
export function toSnapshotOtu(document: unknown): IndexOtu {
	const otu = asDocument(document, "OTU");
	const id = readId(otu, "OTU");

	return {
		abbreviation: readOptionalString(otu, "abbreviation", `OTU ${id}`) ?? "",
		id,
		isolates: readArray(otu, "isolates", `OTU ${id}`).map((isolate) =>
			toIsolate(isolate, id),
		),
		name: readString(otu, "name", `OTU ${id}`),
		schema: readOptionalArray(otu, "schema", `OTU ${id}`).map((item) =>
			toSchemaItem(item, id),
		),
		taxid: readOptionalNumber(otu, "taxid", `OTU ${id}`),
		version: readNumber(otu, "version", `OTU ${id}`),
	};
}

function toIsolate(document: unknown, otuId: string): IndexOtuIsolate {
	const isolate = asDocument(document, `isolate of OTU ${otuId}`);
	const id = readId(isolate, `isolate of OTU ${otuId}`);
	const where = `isolate ${id} of OTU ${otuId}`;

	return {
		default: readBoolean(isolate, "default", where),
		id,
		sequences: readArray(isolate, "sequences", where).map((sequence) =>
			toSequence(sequence, where),
		),
		source_name: readString(isolate, "source_name", where),
		source_type: readString(isolate, "source_type", where),
	};
}

function toSequence(document: unknown, where: string): IndexOtuSequence {
	const sequence = asDocument(document, `sequence of ${where}`);
	const id = readId(sequence, `sequence of ${where}`);

	return {
		accession: readString(sequence, "accession", `sequence ${id}`),
		definition: readString(sequence, "definition", `sequence ${id}`),
		host: readOptionalString(sequence, "host", `sequence ${id}`),
		id,
		segment: readOptionalString(sequence, "segment", `sequence ${id}`),
		sequence: readString(sequence, "sequence", `sequence ${id}`),
	};
}

function toSchemaItem(document: unknown, otuId: string): IndexOtuSchemaItem {
	const item = asDocument(document, `schema item of OTU ${otuId}`);
	const where = `schema item of OTU ${otuId}`;

	return {
		molecule: readOptionalString(item, "molecule", where),
		name: readString(item, "name", where),
		required:
			item.required === undefined ? true : readBoolean(item, "required", where),
	};
}

function asDocument(value: unknown, where: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new IndexSnapshotOtuError(`${where} is not a document`);
	}

	return value as Record<string, unknown>;
}

// `_id` is what the stored document carries; `id` is what a document that has
// already been through a read path carries. Both are accepted, as they are by
// the writer on the other side of this format.
function readId(document: Record<string, unknown>, where: string): string {
	const value = document._id ?? document.id;

	if (typeof value !== "string") {
		throw new IndexSnapshotOtuError(`${where} has no id`);
	}

	return value;
}

function readString(
	document: Record<string, unknown>,
	key: string,
	where: string,
): string {
	const value = document[key];

	if (typeof value !== "string") {
		throw new IndexSnapshotOtuError(`${where} has no ${key}`);
	}

	return value;
}

function readOptionalString(
	document: Record<string, unknown>,
	key: string,
	where: string,
): string | null {
	const value = document[key];

	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value !== "string") {
		throw new IndexSnapshotOtuError(`${where} has a non-string ${key}`);
	}

	return value;
}

function readNumber(
	document: Record<string, unknown>,
	key: string,
	where: string,
): number {
	const value = document[key];

	if (typeof value !== "number") {
		throw new IndexSnapshotOtuError(`${where} has no ${key}`);
	}

	return value;
}

function readOptionalNumber(
	document: Record<string, unknown>,
	key: string,
	where: string,
): number | null {
	const value = document[key];

	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value !== "number") {
		throw new IndexSnapshotOtuError(`${where} has a non-numeric ${key}`);
	}

	return value;
}

function readBoolean(
	document: Record<string, unknown>,
	key: string,
	where: string,
): boolean {
	const value = document[key];

	if (typeof value !== "boolean") {
		throw new IndexSnapshotOtuError(`${where} has no ${key}`);
	}

	return value;
}

function readArray(
	document: Record<string, unknown>,
	key: string,
	where: string,
): unknown[] {
	const value = document[key];

	if (!Array.isArray(value)) {
		throw new IndexSnapshotOtuError(`${where} has no ${key}`);
	}

	return value;
}

function readOptionalArray(
	document: Record<string, unknown>,
	key: string,
	where: string,
): unknown[] {
	const value = document[key];

	if (value === undefined || value === null) {
		return [];
	}

	return readArray(document, key, where);
}
