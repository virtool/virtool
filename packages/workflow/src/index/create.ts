/**
 * The write half of the artifact: the port of Python's `_create_index_sqlite`.
 *
 * A workflow needs this because pathoscope collapses the reference it was given
 * — `cd-hit-est` drops near-duplicate isolates — and writes the survivors as a
 * second artifact it then reads back through {@link openWorkflowIndex}. The
 * collapsed file has to be one Python's reader accepts too, because the two
 * implementations run side by side during the port.
 *
 * ## Everything goes in one transaction
 *
 * SQLite commits per statement outside a transaction, which on a 200–500 MB
 * index means one fsync per sequence row. Wrapping the load makes it one, and
 * is the whole of the performance story here — see `docs/workflow-runtime.md`
 * for the measurement.
 */

import { unlink } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import type { IndexOtu, IndexReference } from "./queries";
import { createIndexArtifactSchema } from "./schema";

/** The reference metadata to record, if the source has any. */
export type CreateIndexReference = IndexReference;

/**
 * Write a SQLite artifact at `path` holding `otus`, replacing any file there.
 *
 * `otus` is consumed lazily and never collected, so a caller can pipe a filtered
 * or collapsed stream straight through without holding the index in memory.
 *
 * `reference` is optional because Python's own writer accepts an OTU-only
 * source: an index built from a legacy `otus.json` has no reference document to
 * record, and every `otus.reference_id` is then null.
 */
export async function createIndexArtifact(
	path: string,
	reference: CreateIndexReference | null,
	otus: AsyncIterable<IndexOtu> | Iterable<IndexOtu>,
): Promise<void> {
	// Only an absent file is unremarkable. A path that cannot be unlinked is
	// reported here rather than swallowed, because the DDL would otherwise run
	// against the file still sitting there and fail as "table already exists",
	// naming neither the path nor the real reason.
	await unlink(path).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "ENOENT") {
			throw error;
		}
	});

	const database = createIndexArtifactSchema(path);

	try {
		database.exec("BEGIN");

		try {
			const referenceId =
				reference === null ? null : insertReference(database, reference);

			const insertOtu = database.prepare(
				`INSERT INTO otus (id, reference_id, abbreviation, name, taxid, version)
					VALUES (?, ?, ?, ?, ?, ?)`,
			);

			const insertSchemaItem = database.prepare(
				`INSERT INTO otu_schema (otu_id, name, molecule, required) VALUES (?, ?, ?, ?)`,
			);

			const insertIsolate = database.prepare(
				`INSERT INTO isolates (virtool_id, otu_id, source_type, source_name, is_default)
					VALUES (?, ?, ?, ?, ?) RETURNING id`,
			);

			const insertSequence = database.prepare(
				`INSERT INTO sequences (id, isolate_id, accession, definition, host, segment, sequence)
					VALUES (?, ?, ?, ?, ?, ?, ?)`,
			);

			for await (const otu of otus) {
				insertOtu.run(
					otu.id,
					referenceId,
					otu.abbreviation,
					otu.name,
					otu.taxid,
					otu.version,
				);

				for (const item of otu.schema) {
					insertSchemaItem.run(
						otu.id,
						item.name,
						item.molecule,
						item.required ? 1 : 0,
					);
				}

				for (const isolate of otu.isolates) {
					const row = insertIsolate.get(
						isolate.id,
						otu.id,
						isolate.source_type,
						isolate.source_name,
						isolate.default ? 1 : 0,
					);

					const isolateId = Number(row?.id);

					// `INSERT … RETURNING` either throws or hands back the row, so
					// this cannot fire today. It is here because the alternative to
					// checking is writing `NaN` into every one of the isolate's
					// sequences, and the rowid is what ties them to their OTU.
					if (!Number.isInteger(isolateId)) {
						throw new Error(
							`Inserting isolate ${isolate.id} of OTU ${otu.id} returned no rowid`,
						);
					}

					for (const sequence of isolate.sequences) {
						insertSequence.run(
							sequence.id,
							isolateId,
							sequence.accession,
							sequence.definition,
							sequence.host,
							sequence.segment,
							sequence.sequence,
						);
					}
				}
			}

			database.exec("COMMIT");
		} catch (error) {
			database.exec("ROLLBACK");

			throw error;
		}
	} finally {
		database.close();
	}
}

function insertReference(
	database: DatabaseSync,
	reference: CreateIndexReference,
): string {
	database
		.prepare(
			`INSERT INTO reference (id, created_at, data_type, name, organism)
				VALUES (?, ?, ?, ?, ?)`,
		)
		.run(
			reference.id,
			reference.created_at,
			reference.data_type,
			reference.name,
			reference.organism,
		);

	return reference.id;
}
