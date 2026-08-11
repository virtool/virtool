import { createLogger } from "@virtool/logger";
import { bootstrap } from "./bootstrap";
import { SERVICE } from "./instrument";
import { createTaskRunner } from "./runner";
import { createTaskSpawner } from "./spawner";
import { type TaskContext, taskRegistry } from "./tasks/registry";
import { APP_VERSION } from "./version";

/**
 * The tasks process.
 *
 * One binary carries both halves of Virtool's task system: the periodic spawner,
 * which inserts the scheduled tasks, and the runner, which claims and executes
 * them.
 *
 * The spawner is the half that ships *first* and runs beside Python's, which is
 * still spawning the same five types into the same table until the cutover. The
 * runner claims only the types `taskRegistry` names, so a row of any other type
 * stays queued for the Python runner that still knows it.
 */
async function main(): Promise<void> {
	const context = await bootstrap({ version: APP_VERSION });

	const ctx: TaskContext = { db: context.db, storage: context.storage };

	const drainTimeoutMs = context.config.drainTimeout * 1_000;

	const runner = createTaskRunner({
		ctx,
		db: context.db,
		drainTimeoutMs,
		logger: context.logger,
		recordRun: context.metrics.recordRun,
		registry: taskRegistry,
	});

	const spawner = createTaskSpawner({
		db: context.db,
		logger: context.logger,
		recordSpawn: context.metrics.recordSpawn,
	});

	// The runner's entire shutdown sequence is this one hook — the controller owns
	// `process.exitCode`, the listener, the pool and the Sentry flush. It declares
	// a ceiling of its own because the equal share the other steps take is sized
	// for a socket close, and this one waits out a task that is mid-flight.
	context.onShutdown("taskRunner", runner.stop, { timeoutMs: drainTimeoutMs });

	// Registered after the runner so it stops *first* — hooks run LIFO. There is
	// nothing to drain here, only a tick that is a lock, a read and an insert, so
	// it takes the equal share rather than declaring a ceiling; stopping it early
	// means the drain below is not racing a fresh row into the queue.
	context.onShutdown("taskSpawner", spawner.stop);

	runner.start();
	spawner.start();
}

try {
	await main();
} catch (err) {
	// The logger `bootstrap` builds may not exist yet — a bad `VT_POSTGRES_URL`
	// fails the config parse before anything else is constructed — so this
	// reports through one of its own. `process.exitCode` rather than
	// `process.exit()`, so the line above actually reaches stdout.
	createLogger({ name: SERVICE }).fatal({ err }, "failed to start");
	process.exitCode = 1;
}
