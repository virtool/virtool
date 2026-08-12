import { hostname } from "node:os";
import type {
	JsonObject,
	PeriodicTaskName,
	Task,
	TaskName,
} from "@virtool/contracts";
import {
	and,
	asc,
	eq,
	gt,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { tasks as tasksTable } from "../db/schema/tasks";
import { nowUtc, secondsAgo } from "../db/time";
import { withTimeout } from "../db/timeout";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** Thrown when a requested task does not exist. */
export class TaskNotFoundError extends AppError {}

/**
 * A task type the TS server can spawn. The runner supports every Python task
 * name, but this union only lists the ones we create from here.
 *
 * Written as a subset of {@link TaskName} rather than as its own list of
 * strings, so a name that drifts from the one Python's task class carries is a
 * compile error here instead of a row no runner ever claims.
 */
export type TaskType = Extract<
	TaskName,
	"clone_reference" | "create_index" | "import_reference" | "install_hmms"
>;

/**
 * Insert a pending task row of `type` and return it.
 *
 * The row is all a task runner needs to pick the work up: it polls Postgres for
 * a task with `acquired_at IS NULL`, `complete = false` and a matching `type`,
 * so no further signal is sent from here. `step` mirrors the Python `create`,
 * which seeds it with the task name.
 *
 * `type` is `string` rather than a union because the two exported wrappers own
 * that narrowing, and they narrow to different sets.
 */
async function insertTask(
	db: DbOrTx,
	type: string,
	context: Record<string, unknown>,
): Promise<Task> {
	const row = takeFirstOrThrow(
		await db
			.insert(tasksTable)
			.values({
				complete: false,
				context,
				count: 0,
				// Postgres's clock, not Node's. The periodic spawner's suppression
				// window is `created_at > clock_timestamp() - interval`, so a row
				// stamped from a process clock that runs a second fast against the
				// database's would widen or narrow that window by the skew.
				created_at: nowUtc(),
				progress: 0,
				step: type,
				type,
			})
			.returning({
				complete: tasksTable.complete,
				createdAt: tasksTable.created_at,
				error: tasksTable.error,
				id: tasksTable.id,
				progress: tasksTable.progress,
				step: tasksTable.step,
				type: tasksTable.type,
			}),
	);

	return {
		complete: row.complete ?? false,
		createdAt: row.createdAt,
		error: row.error,
		id: row.id,
		progress: row.progress ?? 0,
		step: row.step ?? "",
		type: row.type,
	};
}

/** Insert a pending task of `type` and return its id. */
export async function createTask(
	db: DbOrTx,
	type: TaskType,
	context: Record<string, unknown> = {},
): Promise<number> {
	const task = await insertTask(db, type, context);

	return task.id;
}

/**
 * How a spawn attempt for one periodic task type ended.
 *
 * `skipped_locked` and `not_due` are told apart rather than folded into one
 * `null`, because the two say different things about the cutover: the first is
 * evidence the advisory lock is being contended — that Python's spawner is
 * still live and the two are excluding each other — and the second is the
 * ordinary steady state. The metrics registry labels its counter with this
 * union rather than declaring a second copy of it.
 */
export type PeriodicSpawnOutcome = "spawned" | "skipped_locked" | "not_due";

/** What {@link createPeriodicTask} did, and the row if it inserted one. */
export type PeriodicSpawnResult =
	| { outcome: "spawned"; task: Task }
	| { outcome: "skipped_locked"; task: null }
	| { outcome: "not_due"; task: null };

/**
 * Spawn a periodic task if one is due, excluding Python's spawner with a
 * transaction-scoped advisory lock on `hashtext(type)`.
 *
 * This runs in production *beside* Python's `PeriodicTaskSpawner`, which spawns
 * the same five types into this same table. The two are mutually excluded by
 * nothing but that lock, and the failure mode is silent: diverge on the key and
 * both spawn, every periodic task runs twice, and nothing errors or logs.
 *
 * Three rules make the exclusion hold, and none of them is a preference:
 *
 * - **The key is `hashtext` of the bare task name, computed in SQL.** Python
 *   emits `pg_try_advisory_xact_lock(hashtext($1))` from
 *   `func.pg_try_advisory_xact_lock(func.hashtext(task_class.name))`. Hashing
 *   in TypeScript, namespacing the name, or reaching for the two-argument
 *   `(int4, int4)` form — a *different lock namespace* — each stops excluding
 *   Python entirely.
 * - **`pg_try_advisory_xact_lock`, never the session-level form.** The
 *   transaction-scoped lock is released by the commit and is the only
 *   pooler-safe one: session locks survive rollback, are reentrant so two
 *   logical spawners sharing a pooled connection do *not* exclude each other,
 *   and PgBouncer lists them as never supported under transaction pooling.
 * - **The recency check matches Python's predicate exactly** — *any* row of the
 *   type inside the window, complete or errored or neither. A stricter rule
 *   here loses to Python's looser one and spawns the duplicate this whole
 *   design exists to prevent.
 *
 * `hashtext` returns a signed **int4**, so the real keyspace is 2³² rather than
 * the 2⁶⁴ the advisory-lock signature implies, and the function is undocumented
 * by deliberate policy and has changed behaviour across major versions. At
 * Virtool's key population — five task names plus one `index_build:{id}` per
 * reference in the same namespace — a collision is ~10⁻⁵ and degrades to a
 * spurious skip, because every call site is a `try_` lock. Widening the hash
 * would break exclusion with Python, which is the whole point. Accept it.
 *
 * `try_` never blocks: `false` means another spawner is handling this type this
 * tick, and the caller moves on without retrying or escalating.
 *
 * The lock, the check and the insert are one transaction; the event is emitted
 * after it commits, so a rolled-back insert cannot announce a row that does not
 * exist. `Db` rather than `DbOrTx` for that reason — this function has to own
 * the transaction it releases the lock with.
 *
 * `intervalSeconds` must be positive. It is validated where the schedule is
 * registered, at startup, rather than on every tick; zero here would leave the
 * window permanently open and spawn on every tick forever.
 */
export async function createPeriodicTask(
	db: Db,
	type: PeriodicTaskName,
	intervalSeconds: number,
): Promise<PeriodicSpawnResult> {
	const result = await db.transaction(
		async (tx): Promise<PeriodicSpawnResult> => {
			const lock = await tx.execute<{ locked: boolean }>(
				sql`select pg_try_advisory_xact_lock(hashtext(${type})) as locked`,
			);

			if (!lock[0]?.locked) {
				return { outcome: "skipped_locked", task: null };
			}

			const [recent] = await tx
				.select({ id: tasksTable.id })
				.from(tasksTable)
				.where(
					and(
						eq(tasksTable.type, type),
						gt(tasksTable.created_at, secondsAgo(intervalSeconds)),
					),
				)
				.limit(1);

			if (recent !== undefined) {
				return { outcome: "not_due", task: null };
			}

			return { outcome: "spawned", task: await insertTask(tx, type, {}) };
		},
	);

	if (result.outcome === "spawned") {
		await emit("tasks", result.task.id, "create");
	}

	return result;
}

/**
 * Read the tasks matching `taskIds`.
 *
 * An id with no row is absent from the result rather than an error — the
 * batched read exists to refresh whatever a client is watching, and a task
 * deleted between the frame and the read is not a failure.
 */
export async function getTasks(db: Db, taskIds: number[]): Promise<Task[]> {
	if (taskIds.length === 0) {
		return [];
	}

	const rows = await db
		.select({
			complete: tasksTable.complete,
			createdAt: tasksTable.created_at,
			error: tasksTable.error,
			id: tasksTable.id,
			progress: tasksTable.progress,
			step: tasksTable.step,
			type: tasksTable.type,
		})
		.from(tasksTable)
		.where(inArray(tasksTable.id, taskIds));

	return rows.map((row) => ({
		complete: row.complete ?? false,
		createdAt: row.createdAt,
		error: row.error,
		id: row.id,
		progress: row.progress ?? 0,
		step: row.step ?? "",
		type: row.type,
	}));
}

export async function getTask(db: Db, taskId: number): Promise<Task> {
	const [task] = await getTasks(db, [taskId]);

	if (!task) {
		throw new TaskNotFoundError();
	}

	return task;
}

/**
 * How long a claim stays valid without a heartbeat.
 *
 * The lease is encoded on `acquired_at` itself — a claim is live while
 * `acquired_at` is within this many seconds of now — so renewing one is a write
 * to a column that already exists. There is no lease column and no DDL; the
 * `tasks` table is Python's.
 */
export const TASK_LEASE_SECONDS = 300;

/**
 * How often the holder of a claim should renew it.
 *
 * Five to one against {@link TASK_LEASE_SECONDS}, the ratio Solid Queue and
 * Sidekiq both settled on: four consecutive heartbeats can be lost — to a
 * garbage-collection pause, a blocked event loop, a brief partition — before a
 * live runner's work becomes claimable by someone else.
 */
export const TASK_HEARTBEAT_SECONDS = 60;

/**
 * Marks a `runner_id` as belonging to this service rather than to Python.
 *
 * Every query that takes work back off a runner is scoped to this prefix.
 * Python never renews `acquired_at`, so a row it claimed and has been working
 * for longer than the lease is indistinguishable from an abandoned one — a
 * reclaimer that could see it would pull live work out from under the Python
 * runner. Scoping at the query level is what makes the drain assumption
 * enforceable rather than a note in a runbook, which is why there is
 * deliberately no configuration flag to widen it. Widening happens once Python
 * no longer runs tasks at all, as an edit here.
 */
const RUNNER_ID_PREFIX = "ts-";

/** A task just claimed by a runner, with the lease it now holds. */
export type ClaimedTask = {
	id: number;
	type: string;
	context: JsonObject;
	step: string | null;
	progress: number;
	createdAt: Date;
	acquiredAt: Date;
	runnerId: string;
};

/** What {@link acquireTask} needs to claim a task. */
export type AcquireTaskOptions = {
	runnerId: string;
	allowedTypes: readonly string[];
	leaseSeconds?: number;
};

/** New progress, and optionally a new step name, for {@link updateTaskProgress}. */
export type TaskProgressValues = {
	progress: number;
	step?: string;
};

/**
 * Identify this process as a task runner.
 *
 * `{hostname}-{pid}` is Python's format, prefixed to mark the row as this
 * service's. The column is `varchar(255)`, which a Kubernetes pod name and a
 * pid cannot come close to filling — and Postgres raises on overflow rather
 * than truncating, so a hostname that did would fail the claim loudly instead
 * of minting an id that collides with another runner's.
 */
export function buildRunnerId(): string {
	return `${RUNNER_ID_PREFIX}${hostname()}-${process.pid}`;
}

/**
 * Match a task no runner holds — never claimed, or claimed by a runner of ours
 * whose lease has run out.
 *
 * Reclaim is folded in here rather than run from a background timer, which is
 * graphile-worker's shape: the claim heals the queue as a side effect of doing
 * its ordinary work, so there is no second loop to schedule, nothing to keep
 * alive when the fleet is idle, and no window between a sweep marking a row
 * free and a claimer taking it.
 *
 * Python's `progress = 0` term is deliberately absent. It was there to avoid
 * re-running partially-finished work, but a row worth reclaiming has almost
 * always reported progress, so the term excluded exactly the rows the reclaim
 * exists for.
 */
function isClaimable(
	allowedTypes: readonly string[],
	leaseSeconds: number,
): SQL | undefined {
	return and(
		eq(tasksTable.complete, false),
		isNull(tasksTable.error),
		inArray(tasksTable.type, [...allowedTypes]),
		or(
			isNull(tasksTable.acquired_at),
			and(
				like(tasksTable.runner_id, `${RUNNER_ID_PREFIX}%`),
				lt(tasksTable.acquired_at, secondsAgo(leaseSeconds)),
			),
		),
	);
}

/**
 * Claim the oldest task of an allowed type for `runnerId`, or return `null`
 * when there is nothing to take.
 *
 * The candidate is picked under `FOR UPDATE SKIP LOCKED` over a one-row window,
 * so a fleet of runners polling together each lock a different row rather than
 * queueing on the same one and waking to find it taken.
 *
 * The predicate is then **repeated** on the outer update. Under Read Committed
 * an updater blocked on a row re-evaluates only its own `WHERE` when the lock
 * clears — not the subquery that chose the row — so without the repeat a
 * claimer that queued behind another would overwrite the winner's claim with
 * its own. The whole disjunction has to be repeated, not just an
 * `acquired_at IS NULL` term, or a row reclaimed a moment ago passes a guard
 * that no longer describes why it was chosen.
 *
 * Emits nothing. A claim changes no field any client displays, and a runner
 * polling an empty queue would otherwise put a frame on every browser each time
 * it found work.
 */
export async function acquireTask(
	db: Db,
	options: AcquireTaskOptions,
): Promise<ClaimedTask | null> {
	const { runnerId, allowedTypes } = options;
	const leaseSeconds = options.leaseSeconds ?? TASK_LEASE_SECONDS;

	if (allowedTypes.length === 0) {
		return null;
	}

	const candidate = db
		.select({ id: tasksTable.id })
		.from(tasksTable)
		.where(isClaimable(allowedTypes, leaseSeconds))
		.orderBy(asc(tasksTable.created_at))
		.limit(1)
		.for("update", { skipLocked: true });

	const [row] = await db
		.update(tasksTable)
		.set({ acquired_at: nowUtc(), runner_id: runnerId })
		.where(
			and(
				eq(tasksTable.id, sql`(${candidate})`),
				isClaimable(allowedTypes, leaseSeconds),
			),
		)
		.returning({
			acquiredAt: tasksTable.acquired_at,
			context: tasksTable.context,
			createdAt: tasksTable.created_at,
			id: tasksTable.id,
			progress: tasksTable.progress,
			runnerId: tasksTable.runner_id,
			step: tasksTable.step,
			type: tasksTable.type,
		});

	if (!row) {
		return null;
	}

	if (row.acquiredAt === null || row.runnerId === null) {
		// Both columns were written by the statement that returned this row. They
		// are nullable only because an unclaimed task leaves them empty.
		throw new Error("claimed task came back without a lease");
	}

	return {
		acquiredAt: row.acquiredAt,
		context: (row.context ?? {}) as JsonObject,
		createdAt: row.createdAt,
		id: row.id,
		progress: row.progress ?? 0,
		runnerId: row.runnerId,
		step: row.step,
		type: row.type,
	};
}

/**
 * Renew the leases `runnerId` holds on `taskIds`, and report which were
 * actually renewed.
 *
 * The renewal is conditional, and the returned ids are how a runner learns it
 * has been fenced: a task whose lease expired and was reclaimed no longer
 * carries this runner's id, so it is silently absent from the result. Callers
 * diff the result against what they asked for and abandon the difference —
 * which is why this reports rather than throwing, since a partial result is the
 * normal outcome, not an error.
 *
 * Emits nothing, for the reason {@link acquireTask} does not: a heartbeat every
 * minute per running task would cost every connected browser a refetch for a
 * timestamp no view displays.
 */
export async function renewLeases(
	db: Db,
	taskIds: readonly number[],
	runnerId: string,
): Promise<number[]> {
	if (taskIds.length === 0) {
		return [];
	}

	const rows = await db
		.update(tasksTable)
		.set({ acquired_at: nowUtc() })
		.where(
			and(
				inArray(tasksTable.id, [...taskIds]),
				eq(tasksTable.runner_id, runnerId),
				eq(tasksTable.complete, false),
			),
		)
		.returning({ id: tasksTable.id });

	return rows.map((row) => row.id);
}

/**
 * Mark the task `runnerId` holds as complete.
 *
 * Returns `false` when the write matched nothing — the task is already
 * finished, or this runner was fenced and no longer holds it. A fenced runner
 * finishing its work must not be able to report on a task someone else now
 * owns.
 */
export async function completeTask(
	db: Db,
	taskId: number,
	runnerId: string,
): Promise<boolean> {
	return writeHeldTask(db, taskId, runnerId, {
		complete: true,
		progress: 100,
	});
}

/**
 * Mark the task `runnerId` holds as failed, recording `message`.
 *
 * Sets `complete` as well as `error`, which Python does not: its failure path
 * writes `error` alone and leaves `complete` false, so a failed task stays
 * forever in the set its own `get_counts` reports as neither queued nor
 * running. Failure is terminal here.
 *
 * Returns `false` under the same fencing rule as {@link completeTask}.
 */
export async function failTask(
	db: Db,
	taskId: number,
	runnerId: string,
	message: string,
): Promise<boolean> {
	return writeHeldTask(db, taskId, runnerId, {
		complete: true,
		error: message,
	});
}

/**
 * Record progress, and optionally a new step name, for the task `runnerId`
 * holds.
 *
 * Returns `false` under the same fencing rule as {@link completeTask}.
 */
export async function updateTaskProgress(
	db: Db,
	taskId: number,
	runnerId: string,
	values: TaskProgressValues,
): Promise<boolean> {
	return writeHeldTask(db, taskId, runnerId, {
		progress: values.progress,
		...(values.step !== undefined && { step: values.step }),
	});
}

/**
 * Apply `values` to a task only while `runnerId` still holds it, and emit one
 * `tasks` frame if it did.
 *
 * The guard is what makes every write through here fenced: `runner_id` pins the
 * row to its current holder and `complete` keeps a finished task from being
 * written again. A write that matches nothing emits nothing — a frame for a
 * change that did not happen costs every connected browser a refetch and
 * reports a state the row is not in.
 */
async function writeHeldTask(
	db: Db,
	taskId: number,
	runnerId: string,
	values: Partial<typeof tasksTable.$inferInsert>,
): Promise<boolean> {
	const rows = await db
		.update(tasksTable)
		.set(values)
		.where(
			and(
				eq(tasksTable.id, taskId),
				eq(tasksTable.runner_id, runnerId),
				eq(tasksTable.complete, false),
			),
		)
		.returning({ id: tasksTable.id });

	if (rows.length === 0) {
		return false;
	}

	await emit("tasks", taskId, "update");

	return true;
}

/**
 * Give up the claim `runnerId` holds on `taskId`, leaving the task for another
 * runner.
 *
 * This is the shutdown path: a runner draining on SIGTERM hands its work back
 * rather than letting it sit until the lease expires. Returns `false` when the
 * runner no longer holds the task.
 *
 * Scoped to {@link RUNNER_ID_PREFIX} like every other query that takes work off
 * a runner, so the scope holds however the id was obtained rather than only
 * when it came from {@link buildRunnerId}.
 *
 * Emits nothing. The task returns to exactly the state a client last saw it
 * in — nothing about the row that any view renders has changed.
 */
export async function releaseTask(
	db: Db,
	taskId: number,
	runnerId: string,
): Promise<boolean> {
	const rows = await db
		.update(tasksTable)
		.set({ acquired_at: null, runner_id: null })
		.where(
			and(
				eq(tasksTable.id, taskId),
				eq(tasksTable.runner_id, runnerId),
				like(tasksTable.runner_id, `${RUNNER_ID_PREFIX}%`),
				eq(tasksTable.complete, false),
			),
		)
		.returning({ id: tasksTable.id });

	return rows.length > 0;
}

/**
 * Give up every unfinished claim `runnerId` holds, and report which.
 *
 * The bulk form of {@link releaseTask}, for a runner draining on shutdown or
 * clearing whatever a previous incarnation left behind at startup. Scoped and
 * silent for the same reasons.
 */
export async function releaseRunnerClaims(
	db: Db,
	runnerId: string,
): Promise<number[]> {
	const rows = await db
		.update(tasksTable)
		.set({ acquired_at: null, runner_id: null })
		.where(
			and(
				eq(tasksTable.runner_id, runnerId),
				like(tasksTable.runner_id, `${RUNNER_ID_PREFIX}%`),
				eq(tasksTable.complete, false),
			),
		)
		.returning({ id: tasksTable.id });

	return rows.map((row) => row.id);
}

/**
 * The predicate Python's `TasksData.get_counts` counts under: a task that is
 * neither finished nor failed.
 *
 * Reproduced term for term, because the pre- and post-cutover comparison is
 * only apples-to-apples if both sides count the same rows. It is also the
 * predicate of Python's `idx_tasks_active` partial index, so the reads below
 * are served by it rather than scanning a table whose completed rows accumulate
 * without bound.
 *
 * Note that `error IS NULL` and `complete = false` are *both* required. A
 * Python failure writes `error` and leaves `complete` false, so neither term
 * implies the other on rows Python wrote.
 */
function isActive(): SQL | undefined {
	return and(eq(tasksTable.complete, false), isNull(tasksTable.error));
}

/** Active tasks of one type, split the way Python's `get_counts` splits them. */
export type TaskCount = {
	type: string;
	/** Active and unclaimed — Python's `queued`. */
	queued: number;
	/** Active and claimed — Python's `running`. */
	running: number;
};

/** How long the oldest unclaimed task of a type has been waiting. */
export type OldestQueuedTaskAge = {
	type: string;
	ageSeconds: number;
};

/** The active task queue as a `/metrics` scrape reports it. */
export type TaskQueueSnapshot = {
	counts: TaskCount[];
	oldestQueuedAges: OldestQueuedTaskAge[];
};

/**
 * How long a scrape waits on the task-queue reads before abandoning them.
 *
 * Matched to the job queue's bound, and for the same reason: these run on the
 * pool this process claims and heartbeats tasks over, so a saturated pool
 * queues them *client-side*, where no statement timeout applies.
 */
export const TASK_QUEUE_PROBE_TIMEOUT_MS = 2000;

/**
 * Count the active tasks of each type, queued and running.
 *
 * The two counts come from one grouped scan rather than two queries, since they
 * partition the same predicate — and a queue read split across two statements
 * can report a task in neither half, or in both, if it is claimed between them.
 *
 * The `type` breakdown is additional to Python, which reports two scalars.
 * Summing over `type` reproduces them exactly, so the breakdown costs the
 * comparison nothing and is what makes the gauge actionable: "twelve queued"
 * says nothing about whether anything can drain them.
 */
export async function readTaskCounts(db: Db): Promise<TaskCount[]> {
	return db
		.select({
			type: tasksTable.type,
			queued: sql<number>`
				count(*) filter (where ${isNull(tasksTable.acquired_at)})
			`.mapWith(Number),
			running: sql<number>`
				count(*) filter (where ${isNotNull(tasksTable.acquired_at)})
			`.mapWith(Number),
		})
		.from(tasksTable)
		.where(isActive())
		.groupBy(tasksTable.type);
}

/**
 * Age the oldest task still waiting for a runner, per type.
 *
 * Depth alone cannot tell a busy fleet from a stalled one — a queue holding at
 * twelve looks the same whether it is being drained and refilled or not being
 * drained at all. This is the series that separates them, and during the
 * cutover it is the one that says the TypeScript runner has actually started
 * claiming.
 *
 * The subtraction happens in Postgres, with `created_at` pinned to UTC on the
 * way into it. The column is a naive `timestamp`, so left to the session's time
 * zone the age would be wrong by that offset — and both writers, Python and
 * Drizzle, store UTC.
 */
export async function readOldestQueuedTaskAges(
	db: Db,
): Promise<OldestQueuedTaskAge[]> {
	return db
		.select({
			type: tasksTable.type,
			ageSeconds: sql<number>`
				extract(epoch from (now() - (min(${tasksTable.created_at}) at time zone 'UTC')))
			`.mapWith(Number),
		})
		.from(tasksTable)
		.where(and(isActive(), isNull(tasksTable.acquired_at)))
		.groupBy(tasksTable.type);
}

/**
 * Both task-queue reads at once, bounded by
 * {@link TASK_QUEUE_PROBE_TIMEOUT_MS}.
 *
 * This is what a `/metrics` handler should call. The two reads are independent,
 * so they go out concurrently and share one deadline.
 *
 * Still throws on timeout or query failure. A caller drops these series and
 * logs, rather than failing the whole scrape.
 */
export function readTaskQueueBounded(
	db: Db,
	timeoutMs: number = TASK_QUEUE_PROBE_TIMEOUT_MS,
): Promise<TaskQueueSnapshot> {
	return withTimeout(
		Promise.all([readTaskCounts(db), readOldestQueuedTaskAges(db)]).then(
			([counts, oldestQueuedAges]) => ({ counts, oldestQueuedAges }),
		),
		timeoutMs,
	);
}

/**
 * Take back every claim held by one of our runners whose lease has run out, and
 * report which.
 *
 * {@link acquireTask} already reclaims as it claims, so nothing calls this on a
 * running fleet. It ships as its own query for the cutover, whose last step is
 * widening the prefix scope below to recover what Python was mid-flight on when
 * its deployment was deleted — a sweep that has to be invocable on its own,
 * because by then there is no claim left to fold it into.
 *
 * Scoped to {@link RUNNER_ID_PREFIX}: a row Python holds is never touched.
 *
 * Emits nothing. A reclaimed task is pending again, which is the state a client
 * last saw it in.
 */
export async function reclaimExpiredLeases(
	db: Db,
	options: { leaseSeconds?: number } = {},
): Promise<number[]> {
	const leaseSeconds = options.leaseSeconds ?? TASK_LEASE_SECONDS;

	const rows = await db
		.update(tasksTable)
		.set({ acquired_at: null, runner_id: null })
		.where(
			and(
				like(tasksTable.runner_id, `${RUNNER_ID_PREFIX}%`),
				lt(tasksTable.acquired_at, secondsAgo(leaseSeconds)),
				eq(tasksTable.complete, false),
				isNull(tasksTable.error),
			),
		)
		.returning({ id: tasksTable.id });

	return rows.map((row) => row.id);
}
