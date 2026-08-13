/**
 * The NuVs BLAST sweep, ported from Python's `BLASTData.sweep`.
 *
 * A NuVs BLAST search is described entirely by its `nuvs_blast` row, and the
 * sweep is the only thing that ever advances one. There is no queue and no
 * per-search timer: every thirty seconds a task reads the outstanding rows,
 * decides from the row itself what each one needs, and does one step of it.
 *
 * * a row with no `rid` has not reached NCBI yet, and is submitted;
 * * a row with a `rid` has a search running on NCBI, and is checked;
 * * a row that is `ready` or carries an `error` is finished, and is invisible
 *   to the read.
 *
 * A row is only touched once its own `interval` has elapsed since its
 * `last_checked_at`, which is what spaces requests out per search rather than
 * per sweep, and a row that has outlived {@link SEARCH_TIMEOUT_MS} is deleted.
 */

import type { Logger } from "@virtool/logger";
import { and, eq, isNull } from "drizzle-orm";
import { findNuvsSequenceByIndex } from "../analyses/data";
import type { Db } from "../db/pg";
import { analyses, nuvsBlast } from "../db/schema/analyses";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import {
	BlastResultUnreadableError,
	type BlastSearchStatus,
	checkBlastStatus,
	fetchBlastResult,
	formatBlastContent,
	submitBlast,
} from "./ncbi";

/** Seconds between a search's first two status checks. */
const INITIAL_INTERVAL_SECONDS = 3;

/** Seconds added to a search's interval after each status check. */
const INTERVAL_STEP_SECONDS = 5;

/** The longest interval that may separate two status checks of one search. */
const MAX_INTERVAL_SECONDS = 75;

/**
 * How long a search may remain unfinished before it is abandoned.
 *
 * A constant rather than configuration, for the same reason `timeout_jobs`'
 * threshold is: how long a search may run is fleet-wide application state, and
 * both runners have to agree on which rows are stale while they run side by
 * side.
 */
const SEARCH_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * How many searches may have their status checked on NCBI at once.
 *
 * NCBI polices submissions far more closely than status checks, which is why
 * this and {@link MAX_CONCURRENT_INITIALIZATIONS} are separate caps rather than
 * one. A row's kind decides which cap it is subject to, so the two pools never
 * contend and a slow submission cannot starve the checks.
 */
const MAX_CONCURRENT_CHECKS = 3;

/**
 * How many searches may be submitted to NCBI at once.
 *
 * One, because Python's serial task runner only ever submitted one at a time
 * and that is the rate NCBI has accepted from Virtool to date. Raising it is a
 * conversation with NCBI, not a tuning exercise.
 */
const MAX_CONCURRENT_INITIALIZATIONS = 1;

/**
 * What NCBI's `Status=FAILED` and `Status=UNKNOWN` are recorded as.
 *
 * Rendered by the SPA's BLAST panel beside a retry button. Python records
 * nothing here at all — see `checkBlastStatus`.
 */
const SEARCH_FAILED_MESSAGE = "NCBI could not complete the search";

/** The columns the sweep needs to decide what a row wants next. */
type SweepRow = {
	id: number;
	analysis_id: number;
	sequence_index: number;
	rid: string | null;
	interval: number | null;
	created_at: Date;
	last_checked_at: Date;
};

/** A row that has reached NCBI, so its `rid` is the search to ask about. */
type RunningRow = SweepRow & { rid: string };

/** Thrown when the contig a search names is no longer in its analysis. */
class BlastSequenceMissingError extends AppError {}

function backedOff(interval: number | null): number {
	return Math.min(
		(interval ?? INITIAL_INTERVAL_SECONDS) + INTERVAL_STEP_SECONDS,
		MAX_INTERVAL_SECONDS,
	);
}

/**
 * Run `work` over `rows`, at most `limit` at a time.
 *
 * Every row is attempted whatever its neighbours do — a rejection is held back
 * until the pool has drained and then rethrown, rather than abandoning rows
 * mid-flight the way a bare `Promise.all` over the whole set would.
 */
async function runPool<T>(
	rows: T[],
	limit: number,
	work: (row: T) => Promise<void>,
): Promise<void> {
	let next = 0;

	async function worker(): Promise<void> {
		while (next < rows.length) {
			const row = rows[next++];

			if (row !== undefined) {
				await work(row);
			}
		}
	}

	const settled = await Promise.allSettled(
		Array.from({ length: Math.min(limit, rows.length) }, worker),
	);

	for (const outcome of settled) {
		if (outcome.status === "rejected") {
			throw outcome.reason;
		}
	}
}

/**
 * Delay the next attempt on a row whose advance failed against NCBI.
 *
 * A failed advance never reaches the database, so the row's `interval` and
 * `last_checked_at` would otherwise stay untouched and the next sweep would
 * retry it immediately. Bumping both with the same backoff a not-ready check
 * uses spaces retries out across an NCBI outage instead of hammering it every
 * thirty seconds until the row expires.
 *
 * No frame and no `analyses.updated_at` bump: nothing a reader can see has
 * changed.
 */
async function backOff(db: Db, row: SweepRow): Promise<void> {
	await db
		.update(nuvsBlast)
		.set({ last_checked_at: new Date(), interval: backedOff(row.interval) })
		.where(eq(nuvsBlast.id, row.id));
}

/**
 * Abandon searches that have outlived {@link SEARCH_TIMEOUT_MS}.
 *
 * **Rows are deleted by primary key.** Re-BLASTing a contig deletes its row and
 * inserts a new one, so deleting by `(analysis_id, sequence_index)` would
 * destroy a fresh search that had replaced the expired one between this sweep's
 * read and its write. The pair is unique and the temptation to use it as the
 * key is real; it is wrong.
 */
async function deleteExpired(
	db: Db,
	logger: Logger,
	expired: SweepRow[],
	now: Date,
): Promise<void> {
	for (const row of expired) {
		const deleted = await db.transaction(async (tx) => {
			const removed = await tx
				.delete(nuvsBlast)
				.where(eq(nuvsBlast.id, row.id))
				.returning({ id: nuvsBlast.id });

			if (removed.length === 0) {
				return false;
			}

			await tx
				.update(analyses)
				.set({ updated_at: now })
				.where(eq(analyses.id, row.analysis_id));

			return true;
		});

		if (deleted) {
			logger.info({ id: row.id, rid: row.rid }, "deleted timed out blast");

			await emit("analyses", row.analysis_id, "update");
		}
	}
}

/**
 * Submit a search to NCBI and store the RID it answers with.
 *
 * The write is guarded on the row still having no RID of its own. Re-BLASTing a
 * contig deletes the row and inserts a replacement, so a row that has gained a
 * RID while this side was talking to NCBI belongs to a newer search, and the
 * RID just obtained addresses a sequence nobody is waiting for.
 *
 * **`interval` is not advanced here**, only `last_checked_at` and `updated_at`.
 * A submission is not a check, so the first status check lands one interval
 * after the submission rather than one backed-off interval.
 */
async function initialize(
	db: Db,
	logger: Logger,
	row: SweepRow,
	signal?: AbortSignal,
): Promise<void> {
	const [analysis] = await db
		.select({ results: analyses.results })
		.from(analyses)
		.where(eq(analyses.id, row.analysis_id))
		.limit(1);

	const sequence = findNuvsSequenceByIndex(
		analysis?.results ?? null,
		row.sequence_index,
	);

	if (sequence === null) {
		throw new BlastSequenceMissingError(
			`Analysis ${row.analysis_id} has no contig ${row.sequence_index}`,
		);
	}

	const rid = await submitBlast(sequence, signal);

	const timestamp = new Date();

	const stored = await db.transaction(async (tx) => {
		const updated = await tx
			.update(nuvsBlast)
			.set({ rid, updated_at: timestamp, last_checked_at: timestamp })
			.where(and(eq(nuvsBlast.id, row.id), isNull(nuvsBlast.rid)))
			.returning({ id: nuvsBlast.id });

		if (updated.length === 0) {
			return false;
		}

		await tx
			.update(analyses)
			.set({ updated_at: timestamp })
			.where(eq(analyses.id, row.analysis_id));

		return true;
	});

	if (!stored) {
		logger.info({ id: row.id, rid }, "discarded rid for superseded blast");

		return;
	}

	logger.info({ id: row.id, rid }, "started blast search");

	await emit("analyses", row.analysis_id, "update");
}

type CheckValues = {
	last_checked_at: Date;
	updated_at: Date;
	error?: string;
	interval?: number;
	ready?: boolean;
	result?: Record<string, unknown>;
};

async function readCheckValues(
	status: BlastSearchStatus,
	row: RunningRow,
	timestamp: Date,
	signal?: AbortSignal,
): Promise<CheckValues> {
	const values: CheckValues = {
		last_checked_at: timestamp,
		updated_at: timestamp,
	};

	if (status === "waiting") {
		return { ...values, interval: backedOff(row.interval) };
	}

	if (status === "failed") {
		return { ...values, error: SEARCH_FAILED_MESSAGE };
	}

	try {
		return {
			...values,
			ready: true,
			result: formatBlastContent(await fetchBlastResult(row.rid, signal)),
		};
	} catch (err) {
		/* Only bytes that are not a readable result stop here — that condition
		   will not clear, so the row records it and stops asking. A refusal or a
		   deadline is thrown on to the caller's backoff instead, being exactly
		   what a later attempt might settle.

		   An envelope whose shape has changed lands in the backoff too, and will
		   fail identically every pass until the row expires. That is Python's
		   behaviour — `format_blast_content` raises outside its `BadZipFile`
		   guard — and both writers have to abandon the same rows until the
		   cutover completes. */
		if (err instanceof BlastResultUnreadableError) {
			return { ...values, error: err.message };
		}

		throw err;
	}
}

/**
 * Sync a search with NCBI, storing its result once it is ready.
 *
 * The write is guarded on the row still carrying the RID that was checked, so a
 * result arriving after a re-BLAST cannot land on the replacement row and
 * present one contig's hits as another's.
 *
 * `analyses.updated_at` is bumped on every outcome, which is Python's
 * behaviour, but a frame goes out only on a terminal one. A pending search is
 * checked as often as every three seconds and each one on screen holds its own
 * analysis query, so a frame per interval bump is a full analysis refetch in
 * every connected browser for a row whose only visible change is a countdown.
 */
async function check(
	db: Db,
	logger: Logger,
	row: RunningRow,
	signal?: AbortSignal,
): Promise<void> {
	const status = await checkBlastStatus(row.rid, signal);

	const timestamp = new Date();

	const values = await readCheckValues(status, row, timestamp, signal);

	const stored = await db.transaction(async (tx) => {
		const updated = await tx
			.update(nuvsBlast)
			.set(values)
			.where(and(eq(nuvsBlast.id, row.id), eq(nuvsBlast.rid, row.rid)))
			.returning({ id: nuvsBlast.id });

		if (updated.length === 0) {
			return false;
		}

		await tx
			.update(analyses)
			.set({ updated_at: timestamp })
			.where(eq(analyses.id, row.analysis_id));

		return true;
	});

	if (!stored) {
		logger.info(
			{ id: row.id, rid: row.rid },
			"discarded result for superseded blast",
		);

		return;
	}

	if (values.error !== undefined) {
		logger.warn(
			{ id: row.id, rid: row.rid, error: values.error },
			"blast search failed",
		);
	} else if (values.ready) {
		logger.info({ id: row.id, rid: row.rid }, "retrieved result for blast");
	}

	if (status !== "waiting") {
		await emit("analyses", row.analysis_id, "update");
	}
}

/**
 * Advance every outstanding NuVs BLAST search by one step.
 *
 * One unbounded read: the rows this selects are the searches a user is sitting
 * in front of waiting for, so the set is bounded by how many people have
 * clicked BLAST in the last half hour rather than by how much history the
 * database holds.
 */
export async function sweepBlasts(
	db: Db,
	logger: Logger,
	signal?: AbortSignal,
): Promise<void> {
	const now = new Date();

	const rows = await db
		.select({
			id: nuvsBlast.id,
			analysis_id: nuvsBlast.analysis_id,
			sequence_index: nuvsBlast.sequence_index,
			rid: nuvsBlast.rid,
			interval: nuvsBlast.interval,
			created_at: nuvsBlast.created_at,
			last_checked_at: nuvsBlast.last_checked_at,
		})
		.from(nuvsBlast)
		.where(and(eq(nuvsBlast.ready, false), isNull(nuvsBlast.error)));

	const expired = rows.filter(
		(row) => now.getTime() - row.created_at.getTime() >= SEARCH_TIMEOUT_MS,
	);

	if (expired.length > 0) {
		await deleteExpired(db, logger, expired, now);
	}

	const expiredIds = new Set(expired.map((row) => row.id));

	const due = rows.filter(
		(row) =>
			!expiredIds.has(row.id) &&
			now.getTime() - row.last_checked_at.getTime() >=
				(row.interval ?? INITIAL_INTERVAL_SECONDS) * 1000,
	);

	if (due.length === 0) {
		return;
	}

	async function advance(row: SweepRow): Promise<void> {
		try {
			if (row.rid === null) {
				await initialize(db, logger, row, signal);
			} else {
				await check(db, logger, { ...row, rid: row.rid }, signal);
			}
		} catch (err) {
			// A drain or a fence is not this row's failure, and the claim may
			// already be gone. It escapes untranslated, recording nothing.
			if (signal?.aborted) {
				throw err;
			}

			logger.warn({ err, id: row.id, rid: row.rid }, "failed to advance blast");

			await backOff(db, row);
		}
	}

	// Two pools rather than one, because the caps differ by kind. They run
	// together and both drain before either rejection surfaces, so a submission
	// that throws cannot leave a check half-written.
	const pools = await Promise.allSettled([
		runPool(
			due.filter((row) => row.rid === null),
			MAX_CONCURRENT_INITIALIZATIONS,
			advance,
		),
		runPool(
			due.filter((row) => row.rid !== null),
			MAX_CONCURRENT_CHECKS,
			advance,
		),
	]);

	for (const pool of pools) {
		if (pool.status === "rejected") {
			throw pool.reason;
		}
	}
}
