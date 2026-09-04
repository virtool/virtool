import {
	type DataMigrationFinding,
	type DataMigrationRow,
	finishDataMigration,
	recordDataMigrationFindings,
	startDataMigrationAttempt,
	updateDataMigrationProgress,
} from "@virtool/data/data-migrations/data";
import type { Db, PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import { z } from "zod";

import type {
	AuditDefinition,
	BackfillDefinition,
	DataMigrationArgs,
	FindingReporter,
	RegisteredDataMigration,
} from "./define";
import { describeError } from "./redact";

const FINDING_FLUSH_SIZE = 200;

// Count every finding, but retain only bounded detail for inspection.
const MAX_RECORDED_FINDINGS = 5_000;

/** The persisted resume point of a data migration. */
const StoredProgress = z.object({
	cursor: z.unknown(),
	processed: z.number().int().nonnegative(),
	batches: z.number().int().nonnegative(),
});

/** Buffers findings and writes them in bounded batches. */
type FindingSink = {
	report: FindingReporter;
	/** Write everything outstanding, throwing the first write that failed. */
	drain: () => Promise<void>;
	/** How many findings were reported, including those past the cap. */
	found: () => number;
	/** How many findings were written. */
	written: () => number;
};

/** Buffer synchronous reports and defer write failures until the executor drains them. */
function createFindingSink(db: Db, migrationId: number): FindingSink {
	let found = 0;
	let queued = 0;
	let written = 0;
	let buffer: DataMigrationFinding[] = [];
	let chain: Promise<void> = Promise.resolve();
	let failure: unknown;

	function enqueue(): void {
		const pending = buffer;
		buffer = [];

		chain = chain.then(async () => {
			if (failure !== undefined) {
				return;
			}

			try {
				await recordDataMigrationFindings(db, migrationId, pending);
				written += pending.length;
			} catch (err) {
				failure = err;
			}
		});
	}

	return {
		report(finding) {
			found += 1;

			if (queued >= MAX_RECORDED_FINDINGS) {
				return;
			}

			buffer.push(finding);
			queued += 1;

			if (buffer.length >= FINDING_FLUSH_SIZE) {
				enqueue();
			}
		},
		async drain() {
			if (buffer.length > 0) {
				enqueue();
			}

			await chain;

			if (failure !== undefined) {
				const err = failure;
				failure = undefined;
				throw err;
			}
		},
		found: () => found,
		written: () => written,
	};
}

/** What {@link executeDataMigration} needs to execute one data migration. */
export type RunDataMigrationOptions = {
	db: Db;
	client: PgClient;
	logger: Logger;
	signal: AbortSignal;
};

/**
 * Run one data migration and record what it concluded.
 *
 * **The caller must already hold the framework's advisory lock.** Nothing here
 * takes it: the lock is per process and covers a whole run, so taking it per
 * body would let a second process interleave between two of them.
 *
 * Returns the finished row. It never throws for a body that objects or
 * one that breaks — both are outcomes this records — and throws only when the
 * framework itself cannot write the outcome down.
 */
export async function executeDataMigration(
	options: RunDataMigrationOptions,
	definition: RegisteredDataMigration,
): Promise<DataMigrationRow> {
	const { db, signal } = options;
	const { key, kind, version } = definition;

	const logger = options.logger.child({ migration: key, version });

	const row = await startDataMigrationAttempt(db, key, version, kind);

	logger.info(
		{ attempt: row.attempts, kind },
		"started a data migration attempt",
	);

	const sink = createFindingSink(db, row.id);

	const args: DataMigrationArgs = {
		client: options.client,
		logger,
		signal,
		report: sink.report,
	};

	try {
		signal.throwIfAborted();
		const summary =
			definition.kind === "audit"
				? await runAudit(definition, args)
				: await runBackfill(db, definition, args, row, sink);

		await sink.drain();
		signal.throwIfAborted();

		const finished = await finishDataMigration(db, row.id, {
			status: sink.found() === 0 ? "passed" : "failed",
			summary: { ...summary, findings: sink.found(), recorded: sink.written() },
		});

		logger.info(
			{
				status: finished.status,
				findings: sink.found(),
				recorded: sink.written(),
			},
			"finished a data migration attempt",
		);

		return finished;
	} catch (err) {
		// Findings the attempt did produce are worth keeping even though it did not
		// finish: they are what an operator reads first. A failure to write them
		// must not mask the error that got here.
		await sink.drain().catch((drainErr: unknown) => {
			logger.warn({ err: drainErr }, "failed to record pending findings");
		});

		const error = describeError(err);

		const finished = await finishDataMigration(db, row.id, {
			status: "errored",
			error,
			summary: { findings: sink.found(), recorded: sink.written() },
		});

		logger.error({ err, error }, "a data migration attempt errored");

		return finished;
	}
}

/** Thrown when an attempt is cut short by the process shutting down. */
class DataMigrationAbortedError extends Error {}

/** Run an audit body to completion. */
async function runAudit(
	definition: AuditDefinition,
	args: DataMigrationArgs,
): Promise<Record<string, unknown>> {
	await definition.run(args);

	return {};
}

/** Checkpoint only clean batches; committed writes may be replayed after interruption. */
async function runBackfill(
	db: Db,
	definition: BackfillDefinition<unknown>,
	args: DataMigrationArgs,
	row: DataMigrationRow,
	sink: FindingSink,
): Promise<Record<string, unknown>> {
	let cursor: unknown = definition.initialCursor;
	let processed = 0;
	let batches = 0;

	const stored = StoredProgress.safeParse(row.progress);

	if (stored.success) {
		const parsed = definition.cursor.safeParse(stored.data.cursor);

		if (parsed.success) {
			cursor = parsed.data;
			processed = stored.data.processed;
			batches = stored.data.batches;

			args.logger.info({ processed, batches }, "resumed a data migration");
		} else {
			// Safe only because batches are idempotent: starting over repeats work
			// rather than corrupting it, whereas honouring a cursor a patched
			// implementation cannot read would skip whatever it points past.
			args.logger.warn(
				"discarded a stored cursor this implementation no longer understands",
			);
		}
	}

	for (;;) {
		if (args.signal.aborted) {
			throw new DataMigrationAbortedError(
				"interrupted before the data migration finished",
			);
		}

		const result = await definition.runBatch({
			...args,
			cursor,
			batchSize: definition.batchSize,
		});

		await sink.drain();

		if (sink.found() > 0 || result === null) {
			break;
		}

		cursor = result.cursor;
		processed += result.processed;
		batches += 1;

		await updateDataMigrationProgress(db, row.id, {
			cursor,
			processed,
			batches,
		});

		args.logger.debug({ processed, batches }, "committed a batch");
	}

	return { processed, batches };
}
