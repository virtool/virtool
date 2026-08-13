import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import {
	type ReferenceSourceData,
	ReferenceSourceDataSchema,
} from "@virtool/contracts";
import { populateImportedReference } from "@virtool/data/references/populate";
import { getUploadFileByNameOnDisk } from "@virtool/data/uploads/data";
import { openWorkflowIndex } from "@virtool/sqlite";
import type { StorageBackend } from "@virtool/storage";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `import_reference` carries the upload it is to read and the reference it is
 * to fill.
 *
 * `name_on_disk` rather than the upload's id, because that is what
 * `createReference` writes onto the context and what Python's task reads. It
 * does not locate the object — the storage key is resolved from the row.
 */
const payload = z.object({
	name_on_disk: z.string().min(1),
	ref_id: z.number().int().positive(),
	user_id: z.number().int().positive(),
});

/**
 * The most decompressed bytes an uploaded JSON reference may expand to.
 *
 * The file is parsed with `JSON.parse`, so the whole document is held as one
 * string and then again as objects — peak resident memory runs three to five
 * times the decompressed size. 512 MiB therefore needs a runner with a couple
 * of gigabytes, which the pod has, while still refusing a gzip bomb long before
 * V8 raises `ERR_STRING_TOO_LONG` and buries the real cause.
 *
 * Measured against a real export: 6.15 MB gzipped inflates to 24.9 MB, so this
 * is roughly twenty times the largest reference seen in production.
 */
const MAX_INFLATED_BYTES = 512 * 1024 * 1024;

const JSON_SUFFIX = ".json.gz";

const SQLITE_SUFFIX = ".v1.sqlite";

/** Thrown when an upload cannot be read as the reference it claims to be. */
class ReferenceImportError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "ReferenceImportError";
	}
}

export const importReferenceTask = defineTask<typeof payload, TaskContext>({
	type: "import_reference",
	payload,
	// Python names its step after the bound method it runs, `BaseTask.run`
	// writing `func.__name__` into the column. Both runners write
	// `import_reference` for the same work until the cutover completes.
	steps: ["import_reference"],
	async run({ ctx, helpers, payload, signal }) {
		await helpers.runStep("import_reference", async (report) => {
			const upload = await getUploadFileByNameOnDisk(
				ctx.db,
				payload.name_on_disk,
			);

			if (upload === null) {
				throw new ReferenceImportError(
					"The uploaded reference file could not be found",
				);
			}

			const data = await loadSourceData(
				ctx.storage,
				upload.key,
				payload.name_on_disk,
				payload.ref_id,
				signal,
			);

			await populateImportedReference(
				ctx.db,
				{
					data,
					referenceId: payload.ref_id,
					userId: payload.user_id,
				},
				async (percent) => {
					report(percent / 100);
				},
				signal,
			);
		});
	},
});

/**
 * Read and validate the upload, dispatching on the suffix as Python does.
 *
 * The suffix is the only thing that distinguishes the two formats — an upload
 * has no recorded content type — and an unrecognised one is refused rather than
 * guessed at, because opening a JSON export as SQLite fails with a message
 * about a corrupt database.
 */
async function loadSourceData(
	storage: StorageBackend,
	key: string,
	nameOnDisk: string,
	referenceId: number,
	signal: AbortSignal,
): Promise<ReferenceSourceData> {
	let raw: unknown;

	if (nameOnDisk.endsWith(JSON_SUFFIX)) {
		raw = await readGzippedJson(storage, key, signal);
	} else if (nameOnDisk.endsWith(SQLITE_SUFFIX)) {
		raw = await readSqliteSnapshot(storage, key, referenceId, signal);
	} else {
		throw new ReferenceImportError(
			`Unsupported reference file name; expected a ${JSON_SUFFIX} or ${SQLITE_SUFFIX} suffix`,
		);
	}

	const parsed = ReferenceSourceDataSchema.safeParse(raw);

	if (!parsed.success) {
		throw new ReferenceImportError(describeInvalidData(parsed.error));
	}

	return parsed.data;
}

/**
 * Inflate the upload and parse it, refusing anything past the size cap.
 *
 * The count is of bytes leaving the gunzip stream, never `storage.size`, which
 * reports the compressed figure and so says nothing about what the file expands
 * to.
 */
async function readGzippedJson(
	storage: StorageBackend,
	key: string,
	signal: AbortSignal,
): Promise<unknown> {
	const chunks: Buffer[] = [];

	let inflated = 0;

	try {
		/* Assembled with `pipeline` rather than `.pipe()`. A source that rejects
		   part-way — storage failing mid-download, or the signal aborting — does
		   not reach a `.pipe()`d destination, so the consumer would wait on a
		   gunzip stream nothing is going to end and the source's error would go
		   unhandled. `pipeline` destroys every stage with it and rethrows here. */
		await pipeline(
			Readable.from(storage.read(key)),
			createGunzip(),
			async (source: AsyncIterable<Buffer>) => {
				for await (const chunk of source) {
					inflated += chunk.length;

					if (inflated > MAX_INFLATED_BYTES) {
						throw new ReferenceImportError(
							`Reference file exceeds the ${MAX_INFLATED_BYTES / (1024 * 1024)} MB decompressed limit`,
						);
					}

					chunks.push(chunk);
				}
			},
			{ signal },
		);
	} catch (err) {
		throw describeDecompressionFailure(err, signal);
	}

	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch (err) {
		throw new ReferenceImportError((err as Error).message, { cause: err });
	}
}

/**
 * Spool the upload to disk and read it as a reference snapshot.
 *
 * `node:sqlite` opens a path and has no streaming reader, so the object has to
 * land on the filesystem first. The OTUs are collected rather than streamed
 * because the duplicate checks span the whole file and the populate needs a
 * count before it can report progress.
 */
async function readSqliteSnapshot(
	storage: StorageBackend,
	key: string,
	referenceId: number,
	signal: AbortSignal,
): Promise<unknown> {
	const workPath = await mkdtemp(join(tmpdir(), "vt-import-reference-"));
	const path = join(workPath, "reference-snapshot.v1.sqlite");

	try {
		await pipeline(Readable.from(storage.read(key)), createWriteStream(path), {
			signal,
		});

		const snapshot = openWorkflowIndex({ id: referenceId, path });

		try {
			const metadata = await snapshot.getReferenceMetadata();

			const otus = [];

			for await (const otu of snapshot.iterOtus()) {
				signal.throwIfAborted();

				otus.push(otu);
			}

			return {
				data_type: metadata.data_type,
				organism: metadata.organism,
				otus,
			};
		} finally {
			snapshot.close();
		}
	} finally {
		await rm(workPath, { force: true, recursive: true });
	}
}

/**
 * Name a decompression failure the way Python's caller does, leaving an abort
 * alone.
 *
 * Python matches `"Not a gzipped file"` out of the text `zlib` raises; Node's
 * message for the same condition is `incorrect header check`, so the check is
 * on the condition rather than on the wording, and the string is reproduced so
 * both runners put the same sentence in front of a user.
 */
function describeDecompressionFailure(
	err: unknown,
	signal: AbortSignal,
): Error {
	/* An abort is the process going away, not a bad upload, and it is returned
	   untranslated so `runTask` reports `aborted` and the task is released for
	   another runner to re-run from step zero. Calling it a decompression
	   failure would fail the task and record an error against a file that is
	   perfectly good. */
	if (signal.aborted || (err instanceof Error && err.name === "AbortError")) {
		return err instanceof Error ? err : new Error(String(err));
	}

	if (err instanceof ReferenceImportError) {
		return err;
	}

	const message = err instanceof Error ? err.message : String(err);

	if (message.includes("incorrect header check")) {
		return new ReferenceImportError("Not a gzipped file", { cause: err });
	}

	return new ReferenceImportError(message, { cause: err });
}

/** The most schema problems named before the message is truncated. */
const MAX_REPORTED_ISSUES = 3;

/**
 * Summarise a validation failure into something a popover can hold.
 *
 * `tasks.error` is rendered to the user, and a raw `ZodError` dump over a file
 * with thousands of OTUs is both unreadable and unbounded. Each problem is
 * located by its path, which for a source file names the offending OTU by
 * index.
 */
function describeInvalidData(error: z.ZodError): string {
	const issues = error.issues.map((issue) => {
		const path = issue.path.join(".");

		return path ? `${path}: ${issue.message}` : issue.message;
	});

	const shown = issues.slice(0, MAX_REPORTED_ISSUES).join("; ");

	const summary =
		issues.length > MAX_REPORTED_ISSUES
			? `${shown} and ${issues.length - MAX_REPORTED_ISSUES} more`
			: shown;

	return `Invalid reference data: ${summary}`;
}
