// Bulk-populating a brand new reference with OTUs, sequences and history.
//
// A port of `virtool.references.alot` and `populate_insert_only_reference`, plus
// the `populate_cloned_reference` and `populate_imported_reference` that drive
// them for a clone and an import. It is the layer under both the
// `clone_reference` and `import_reference` tasks.
//
// Neither entry point reads a file. An import's upload is parsed and validated
// by the task body, which hands the documents down; that keeps gzip, SQLite and
// the two upload formats out of a module whose job is writing rows.
//
// Kept out of `./data.ts` because everything here reads OTUs and writes history,
// and `otus/data.ts` already imports this domain's errors — folding it in would
// close that into a cycle.

import { setImmediate } from "node:timers/promises";
import type { HistoryMethod, ReferenceSourceData } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { eq, inArray } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import {
	legacyReferenceGroups,
	legacyReferences,
	legacyReferenceUsers,
} from "../db/schema/references";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { composeDiff, composeHistoryDescription } from "../history/add";
import { otuSpecifierKey, patchOtusToVersions } from "../history/data";
import {
	isolatesOf,
	type OtuDocument,
	otuRowValues,
	randomId,
	type SequenceDocument,
	sequenceRowValues,
	verify,
} from "../otus/data";
import { ReferenceNotFoundError } from "./data";

/**
 * Thrown when the manifest names an OTU version history cannot produce.
 *
 * A manifest entry is proof the OTU existed at that version when the clone was
 * requested, so this is corrupted history rather than a routine miss. The task
 * fails and the half-built reference is rolled back, where skipping the OTU
 * would publish a reference silently missing it.
 */
export class ReferenceManifestError extends AppError {}

/** The values {@link populateClonedReference} works from. */
export type PopulateClonedReferenceValues = {
	/** Every source OTU id mapped to the version to clone it at */
	manifest: Record<string, number>;

	/** The primary key of the reference being populated */
	referenceId: number;

	/** The user the cloned OTUs and their history are attributed to */
	userId: number;

	/**
	 * OTUs patched, prepared and inserted per transaction. Present so a test can
	 * drive the chunking at a size it can seed; production takes the default.
	 */
	chunkSize?: number;
};

/**
 * OTUs written per transaction.
 *
 * A reference runs to tens of thousands of OTUs and hundreds of thousands of
 * sequences. Chunking bounds both the transaction and the peak heap: a chunk is
 * patched, prepared and committed before the next is read, so nothing ever holds
 * the whole reference.
 */
const OTU_CHUNK_SIZE = 1000;

// The most bind parameters a statement may carry. postgres.js allows rather more
// than this, but the figure is Python's and the two write the same rows.
const MAX_BIND_PARAMETERS = 32767;

// Each row binds the columns its `*RowValues` mapper produces, so the row count a
// statement can carry is that divided into the ceiling. Only the sequence rows
// can exceed a chunk on their own — an OTU chunk of a thousand carries a
// thousand OTU rows and a thousand history rows, but as many sequence rows as
// those OTUs happen to hold.
const OTU_ROW_CHUNK_SIZE = Math.floor(MAX_BIND_PARAMETERS / 8);
const SEQUENCE_ROW_CHUNK_SIZE = Math.floor(MAX_BIND_PARAMETERS / 6);
const HISTORY_ROW_CHUNK_SIZE = Math.floor(MAX_BIND_PARAMETERS / 9);
const HISTORY_DIFF_ROW_CHUNK_SIZE = Math.floor(MAX_BIND_PARAMETERS / 3);

/** The length of an OTU id, and of the isolate and sequence ids under it. */
const OTU_ID_LENGTH = 8;
const NESTED_ID_LENGTH = 12;

// The only keys an isolate keeps. A source isolate may carry anything a previous
// Virtool wrote onto it, and a clone is a fresh document rather than a copy of an
// old one.
const ISOLATE_KEYS = new Set([
	"default",
	"id",
	"sequences",
	"source_type",
	"source_name",
]);

/** An OTU, its sequences and its creating history row, ready to be written. */
type PreparedInsertion = {
	otu: OtuDocument;
	sequences: SequenceDocument[];
	history: {
		changeId: string;
		description: string;
		diff: unknown;
		methodName: HistoryMethod;
		otuId: string;
		otuName: string;
		otuVersion: string;
		userId: number;
	};
};

function* chunked<T>(items: T[], size: number): Generator<T[]> {
	for (let start = 0; start < items.length; start += size) {
		yield items.slice(start, start + size);
	}
}

/**
 * Reshape a source OTU into the one a bulk insertion writes, with fresh ids
 * throughout and its sequences lifted out of its isolates.
 *
 * The source document is never touched: the caller's copy comes out of
 * `patchOtusToVersions`, which hands back documents that may share structure
 * with one another, so a mutation in place would corrupt the OTU next to it.
 *
 * `issues` is stored on the document because Python stores it, but the shape is
 * this side's camelCase `OtuIssueReport` rather than Python's snake_case one.
 * Nothing reads the stored field on either side — both recompute `verify` at
 * read time — so the divergence is inert, and reproducing a second, snake_case
 * report here would be a second declaration of a shape the contract already owns.
 */
function prepareOtuInsertion(
	createdAt: Date,
	historyMethod: HistoryMethod,
	source: OtuDocument,
	referenceId: number,
	userId: number,
): PreparedInsertion {
	const otuId = randomId(OTU_ID_LENGTH);
	const otu = structuredClone(source);

	Object.assign(otu, {
		_id: otuId,
		created_at: createdAt,
		imported: true,
		last_indexed_version: null,
		lower_name: String(source.name).toLowerCase(),
		reference: { id: referenceId },
		remote: { id: source._id },
		schema: source.schema ?? [],
		user: { id: userId },
		version: 0,
	});

	for (const isolate of isolatesOf(otu)) {
		const isolateId = randomId(NESTED_ID_LENGTH);

		isolate.id = isolateId;

		for (const sequence of sequencesOf(isolate)) {
			const remote = sequence.remote as { id?: unknown } | undefined;

			Object.assign(sequence, {
				_id: randomId(NESTED_ID_LENGTH),
				isolate_id: isolateId,
				otu_id: otuId,
				// Python's `.get("segment", "")`: an absent segment becomes the empty
				// string, where an explicit null stays null.
				segment: "segment" in sequence ? sequence.segment : "",
				reference: { id: referenceId },
				remote: {
					id:
						remote && typeof remote === "object" && remote.id !== undefined
							? remote.id
							: sequence._id,
				},
			});
		}

		for (const key of Object.keys(isolate)) {
			if (!ISOLATE_KEYS.has(key)) {
				delete isolate[key];
			}
		}
	}

	// Verified while the sequences are still embedded — `verify` reads an isolate's
	// sequence list, and the next loop takes it away.
	const issues = verify(otu);

	Object.assign(otu, { issues, verified: issues === null });

	const sequences: SequenceDocument[] = [];

	for (const isolate of isolatesOf(otu)) {
		sequences.push(...sequencesOf(isolate));

		delete isolate.sequences;
	}

	const otuName = String(otu.name);
	const otuVersion = String(otu.version);

	return {
		otu,
		sequences,
		history: {
			changeId: `${otuId}.${otuVersion}`,
			description: composeHistoryDescription(
				historyMethod,
				otuName,
				otu.abbreviation,
			),
			// Composed against the OTU as it will be stored, isolates already emptied
			// of their sequences. Python does the same, and a diff taken from the
			// joined document instead would describe a document no row holds.
			diff: composeDiff({
				description: "",
				methodName: historyMethod,
				old: null,
				new: otu,
				referenceId,
				userId,
			}),
			methodName: historyMethod,
			otuId,
			otuName,
			otuVersion,
			userId,
		},
	};
}

function sequencesOf(isolate: Record<string, unknown>): SequenceDocument[] {
	const sequences = isolate.sequences;

	return Array.isArray(sequences) ? (sequences as SequenceDocument[]) : [];
}

/**
 * Write a chunk of prepared OTUs, their sequences and their history in one
 * transaction.
 *
 * `position` counts each OTU's sequences off from zero in the order they were
 * flattened out of its isolates, which is the order a joined read must give them
 * back in. A chunk therefore has to carry whole OTUs — splitting one across two
 * calls would start its second half's count at zero again and reorder it.
 */
async function insertPreparedOtus(
	db: Db,
	referenceId: number,
	insertions: PreparedInsertion[],
): Promise<void> {
	if (insertions.length === 0) {
		return;
	}

	const otuRows = insertions.map((insertion) =>
		otuRowValues(insertion.otu, referenceId),
	);

	const sequenceRows = insertions.flatMap((insertion) =>
		insertion.sequences.map((sequence, position) => ({
			...sequenceRowValues(sequence),
			position,
		})),
	);

	// One instant for the whole chunk, and a different one from the OTUs' own
	// `created_at` — which is the reference's. Python stamps each row as it
	// prepares it; a chunk is prepared in a single synchronous stretch, so the
	// two differ by nothing a reader could see.
	const now = new Date();

	const historyRows = insertions.map(({ history }) => ({
		legacy_id: history.changeId,
		created_at: now,
		description: history.description,
		method_name: history.methodName,
		user_id: history.userId,
		otu: history.otuId,
		otu_name: history.otuName,
		otu_version: history.otuVersion,
		reference_id: referenceId,
	}));

	await db.transaction(async (tx) => {
		for (const rows of chunked(otuRows, OTU_ROW_CHUNK_SIZE)) {
			await tx.insert(legacyOtus).values(rows);
		}

		for (const rows of chunked(sequenceRows, SEQUENCE_ROW_CHUNK_SIZE)) {
			await tx.insert(legacySequences).values(rows);
		}

		const historyIds = new Map<string, number>();

		for (const rows of chunked(historyRows, HISTORY_ROW_CHUNK_SIZE)) {
			const written = await tx
				.insert(legacyHistory)
				.values(rows)
				.returning({ id: legacyHistory.id, legacyId: legacyHistory.legacy_id });

			for (const row of written) {
				historyIds.set(String(row.legacyId), row.id);
			}
		}

		// Paired by `legacy_id` rather than by the order the insert returned, so a
		// diff can never be attached to the wrong change.
		const diffRows = insertions.map(({ history }) => {
			const historyId = historyIds.get(history.changeId);

			/* Not a manifest failure: the ids are minted in this function and the
			   insert above is what wrote them, so a miss here is this side's own
			   invariant breaking rather than anything the manifest said. */
			if (historyId === undefined) {
				throw new Error(
					`no history row was written for change ${history.changeId}`,
				);
			}

			return {
				change_id: history.changeId,
				history_id: historyId,
				diff: history.diff,
			};
		});

		for (const rows of chunked(diffRows, HISTORY_DIFF_ROW_CHUNK_SIZE)) {
			await tx.insert(legacyHistoryDiff).values(rows);
		}
	});
}

/**
 * Delete every OTU, sequence, history row and diff the reference carries.
 *
 * Sequences are deleted explicitly rather than left to the cascade from their
 * OTUs. The cascade is real upstream, but it is a database constraint the
 * Drizzle mirror does not declare, so relying on it would make this correct in
 * production and silently wrong anywhere the schema is materialised from the
 * mirror.
 */
async function clearReferenceContents(
	tx: DbOrTx,
	referenceId: number,
): Promise<void> {
	await tx
		.delete(legacyHistoryDiff)
		.where(
			inArray(
				legacyHistoryDiff.history_id,
				tx
					.select({ id: legacyHistory.id })
					.from(legacyHistory)
					.where(eq(legacyHistory.reference_id, referenceId)),
			),
		);

	await tx
		.delete(legacyHistory)
		.where(eq(legacyHistory.reference_id, referenceId));

	await tx
		.delete(legacySequences)
		.where(
			inArray(
				legacySequences.otu_id,
				tx
					.select({ id: legacyOtus.id })
					.from(legacyOtus)
					.where(eq(legacyOtus.reference_id, referenceId)),
			),
		);

	await tx.delete(legacyOtus).where(eq(legacyOtus.reference_id, referenceId));
}

/**
 * Undo a partially completed populate, taking the reference with it.
 *
 * Everything the populate committed goes in one transaction, so the cleanup is
 * atomic and every delete is scoped to the reference's own primary key. The
 * reference row goes last, and it does go: a clone that failed has nothing a
 * user could retry, so Python removes it from the list rather than leaving a
 * half-populated one behind, and the two runners must not disagree about that
 * while both are live.
 */
async function rollbackPopulatedReference(
	db: Db,
	referenceId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		await clearReferenceContents(tx, referenceId);

		await tx
			.delete(legacyReferenceUsers)
			.where(eq(legacyReferenceUsers.reference_id, referenceId));

		await tx
			.delete(legacyReferenceGroups)
			.where(eq(legacyReferenceGroups.reference_id, referenceId));

		await tx
			.delete(legacyReferences)
			.where(eq(legacyReferences.id, referenceId));
	});
}

async function readReferenceCreatedAt(
	db: Db,
	referenceId: number,
): Promise<Date> {
	const [row] = await db
		.select({ createdAt: legacyReferences.created_at })
		.from(legacyReferences)
		.where(eq(legacyReferences.id, referenceId))
		.limit(1);

	if (row === undefined) {
		throw new ReferenceNotFoundError("Reference does not exist");
	}

	return row.createdAt;
}

/**
 * Fill a newly created reference with the OTUs of the one it was cloned from.
 *
 * Every OTU in the manifest is reconstructed at the version the manifest pins
 * it to, given fresh ids, and written with the history row that records its
 * creation. The reference's own `created_at` stamps every OTU, matching Python.
 *
 * Work runs a chunk at a time — patch, prepare, commit — so peak memory is
 * bounded by the chunk rather than by the size of the reference, and the event
 * loop is yielded between chunks so the runner's heartbeat survives a large one.
 *
 * It is idempotent, as a reclaimed task requires. A re-run clears whatever a
 * previous attempt committed before writing anything, because the ids are freshly
 * minted every time and nothing would otherwise stop a second complete set of
 * OTUs landing beside the first.
 *
 * Any failure rolls the whole reference back — its rows and the reference itself
 * — and rethrows. An abort does not: the process is going away, the task will be
 * released and re-run from step zero, and destroying a user's reference because
 * a pod restarted is not a cleanup.
 */
export async function populateClonedReference(
	db: Db,
	logger: Logger,
	values: PopulateClonedReferenceValues,
	onProgress?: (percent: number) => Promise<void>,
	signal?: AbortSignal,
): Promise<void> {
	const { manifest, referenceId, userId, chunkSize = OTU_CHUNK_SIZE } = values;

	const createdAt = await readReferenceCreatedAt(db, referenceId);

	const specifiers = Object.entries(manifest).map(([otuId, version]) => ({
		otuId,
		version,
	}));

	const count = specifiers.length;

	/* Python gives the insert a thirtieth of the bar for every ten OTUs patched,
	   so patching runs to 1/1.3 of it and inserting covers the rest. The split is
	   reproduced rather than rounded off because the two runners' progress is
	   compared during the cutover. */
	const headroom = Math.floor(count * 0.3);
	const total = count + headroom;

	let patched = 0;
	let inserted = 0;

	async function report(): Promise<void> {
		if (total === 0) {
			await onProgress?.(100);

			return;
		}

		const done = patched + (headroom * inserted) / count;

		await onProgress?.((done / total) * 100);
	}

	await db.transaction((tx) => clearReferenceContents(tx, referenceId));

	try {
		for (const slice of chunked(specifiers, chunkSize)) {
			signal?.throwIfAborted();

			const documents = await patchOtusToVersions(db, slice);

			const insertions = slice.map(({ otuId, version }) => {
				const document = documents.get(otuSpecifierKey(otuId, version));

				if (!document) {
					throw new ReferenceManifestError(
						`OTU ${otuId} could not be patched to version ${version}`,
					);
				}

				return prepareOtuInsertion(
					createdAt,
					"clone",
					document,
					referenceId,
					userId,
				);
			});

			patched += slice.length;

			await report();

			/* Preparing a chunk is a long synchronous stretch — a deep copy and a
			   reshape of every document in it — and the runner's heartbeat is a
			   timer. Without a macrotask boundary here a large reference starves it
			   and the task is reclaimed out from under itself. */
			await setImmediate();

			/* Checked again on this side of the yield, and not only at the top of
			   the loop: the yield is exactly where a lost lease is noticed, and the
			   last chunk has no next iteration to notice it in. Another runner may
			   already have cleared the reference and started rebuilding it, and this
			   insert is fenced on nothing. */
			signal?.throwIfAborted();

			await insertPreparedOtus(db, referenceId, insertions);

			inserted += slice.length;

			await report();
		}
	} catch (err) {
		if (signal?.aborted) {
			throw err;
		}

		/* The task id is not this layer's to know; `runTask` logs the failure with
		   it, and this line carries the reference the rollback is about to take. */
		logger.error(
			{ err, reference_id: referenceId },
			"failed to populate a cloned reference; rolling it back",
		);

		await rollbackPopulatedReference(db, referenceId);

		throw err;
	}

	await onProgress?.(100);

	await emit("references", referenceId, "update");
}

/** The values {@link populateImportedReference} works from. */
export type PopulateImportedReferenceValues = {
	/** The parsed contents of the uploaded reference file */
	data: ReferenceSourceData;

	/** The primary key of the reference being populated */
	referenceId: number;

	/** The user the imported OTUs and their history are attributed to */
	userId: number;

	/**
	 * OTUs prepared and inserted per transaction. Present so a test can drive
	 * the chunking at a size it can seed; production takes the default.
	 */
	chunkSize?: number;
};

/**
 * Fill a newly created reference with the OTUs of an uploaded file.
 *
 * The file is parsed and validated before it reaches here — this layer takes
 * documents, never bytes, so neither gzip nor SQLite appears in it. Every OTU
 * is given fresh ids and written with the history row recording its creation,
 * stamped with the reference's own `created_at` as Python does.
 *
 * It is idempotent, as a reclaimed task requires. A re-run clears whatever a
 * previous attempt committed before writing anything, because the ids are
 * minted afresh every time and nothing would otherwise stop a second complete
 * set of OTUs landing beside the first.
 *
 * Nothing is rolled back on failure. A half-populated reference is left for the
 * user to delete or retry against, the clearing above being what makes the
 * retry clean.
 */
export async function populateImportedReference(
	db: Db,
	values: PopulateImportedReferenceValues,
	onProgress?: (percent: number) => Promise<void>,
	signal?: AbortSignal,
): Promise<void> {
	const { data, referenceId, userId, chunkSize = OTU_CHUNK_SIZE } = values;

	const createdAt = await readReferenceCreatedAt(db, referenceId);

	await db.transaction(async (tx) => {
		await clearReferenceContents(tx, referenceId);

		/* Python updates `organism` in its own transaction before inserting
		   anything. Folded into the clearing transaction here so a re-entry
		   cannot leave the column updated against contents it then fails to
		   write. */
		await tx
			.update(legacyReferences)
			.set({ organism: data.organism })
			.where(eq(legacyReferences.id, referenceId));
	});

	const count = data.otus.length;

	let inserted = 0;

	for (const slice of chunked(data.otus, chunkSize)) {
		signal?.throwIfAborted();

		const insertions = slice.map((otu) =>
			prepareOtuInsertion(
				createdAt,
				"import",
				otu as OtuDocument,
				referenceId,
				userId,
			),
		);

		/* Preparing a chunk is a long synchronous stretch — a deep copy and a
		   reshape of every document in it — and the runner's heartbeat is a
		   timer. Without a macrotask boundary here a large reference starves it
		   and the task is reclaimed out from under itself. */
		await setImmediate();

		/* Checked again on this side of the yield, and not only at the top of
		   the loop: the yield is exactly where a lost lease is noticed, and the
		   last chunk has no next iteration to notice it in. Another runner may
		   already have cleared the reference and started rebuilding it, and this
		   insert is fenced on nothing. */
		signal?.throwIfAborted();

		await insertPreparedOtus(db, referenceId, insertions);

		inserted += slice.length;

		await onProgress?.((inserted / count) * 100);
	}

	await emit("references", referenceId, "update");
}
