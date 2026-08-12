import type { Server } from "node:http";
import * as Sentry from "@sentry/node";
import {
	createDb,
	type Db,
	logPostgresVersion,
	type PgClient,
} from "@virtool/data/db/pg";
import { createEmitter } from "@virtool/data/events/emit";
import { createLogger, type Logger } from "@virtool/logger";
import { createSentryLogStream } from "@virtool/sentry/log";
import {
	createShutdownController,
	type ShutdownOptions,
} from "@virtool/service/shutdown";
import { createStorageBackend, type StorageBackend } from "@virtool/storage";
import { parseTasksConfig, type TasksConfig } from "./config";
import { initSentry, SERVICE } from "./instrument";
import { createTaskQueueReader } from "./metrics/queue";
import { createMetrics, type Metrics } from "./metrics/registry";
import { createProbeServer } from "./probes";

/** How long Sentry may spend flushing buffered envelopes, in milliseconds. */
const SENTRY_FLUSH_TIMEOUT = 2_000;

/** Everything a tasks process needs, built once at startup. */
export type AppContext = {
	config: TasksConfig;
	logger: Logger;
	db: Db;
	client: PgClient;
	storage: StorageBackend;
	/**
	 * The write side of this process's Prometheus registry.
	 *
	 * The spawn and claim loops record through it; the read side is already wired
	 * to `/metrics` by the probe listener.
	 */
	metrics: Metrics;
	/**
	 * Register a callback to run on SIGTERM or SIGINT.
	 *
	 * Guarantees a caller can rely on: hooks run **after** readiness has already
	 * flipped to unavailable; hooks run **before** the database pool closes, so a
	 * hook may still write — releasing a task claim, for instance; hooks run in
	 * reverse registration order; each is awaited; a throwing hook does not
	 * prevent the others from running, though it does make the process exit
	 * non-zero; and the whole sequence is bounded by the backstop, so a hook must
	 * not assume unlimited time — one waiting out real work declares its own
	 * ceiling with `options.timeoutMs` rather than taking the equal share, which
	 * is sized for a socket close.
	 */
	onShutdown: (
		name: string,
		hook: () => Promise<void>,
		options?: ShutdownOptions,
	) => void;
	/** Flip readiness independently of shutdown — e.g. while draining. */
	setReady: (ready: boolean) => void;
};

/** What {@link bootstrap} needs that it cannot read from the environment. */
export type BootstrapOptions = {
	/**
	 * This build's version, for `virtool_app_info`.
	 *
	 * Passed explicitly because there is no `__APP_VERSION__` outside Vite: an
	 * ambient global would resolve to `undefined` here and render an empty label
	 * with nothing failing to say so.
	 */
	version: string;
};

function listen(server: Server, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, () => {
			server.removeListener("error", reject);
			resolve();
		});
	});
}

function close(server: Server): Promise<void> {
	return new Promise((resolve) => {
		server.close(() => resolve());
		// `close` stops the listener accepting new connections but waits on the
		// open ones, and the kubelet's probes are keep-alive. Idle sockets are
		// dropped so the wait is bounded by a probe in flight rather than by the
		// next one the kubelet would have sent.
		server.closeIdleConnections();
	});
}

/**
 * Build everything this process runs on, and return it.
 *
 * Nothing in this app happens at import time — no environment parse, no pool,
 * no storage backend, no registry, no `SHOW server_version`. It all happens
 * here, in order, so that importing any module of this app to test it or to
 * read a type costs nothing.
 *
 * The order is load-bearing at three points. Sentry initialises **first**, so
 * a failure anywhere below is reported. The client-event emitter is installed
 * as soon as the pool exists, because `emit` inside `@virtool/data` throws
 * without it and the task frames would never publish. And the probe listener
 * starts **last**, so nothing it reports on is still being built when the
 * kubelet's first probe arrives.
 */
export async function bootstrap(
	options: BootstrapOptions,
): Promise<AppContext> {
	const config = parseTasksConfig();

	const sentry = initSentry(config.sentryDsn);

	// With a DSN configured the logger fans `info`-and-above records out to
	// Sentry's structured logging API as well as stdout. Without one there is no
	// stream, so an unconfigured deploy pays nothing and logs nowhere but stdout.
	const logger = createLogger({
		name: SERVICE,
		streams: sentry.enabled
			? [
					{
						level: "info" as const,
						stream: createSentryLogStream(Sentry.logger),
					},
				]
			: undefined,
	});

	logger.info(
		{ environment: sentry.environment, foundSentryDsn: sentry.enabled },
		sentry.enabled ? "sentry initialised" : "sentry disabled",
	);

	const { client, db, applicationName } = createDb(config, SERVICE);

	createEmitter({ client, logger });

	logPostgresVersion(client, logger);

	const storage = createStorageBackend(config.storage);

	let ready = true;

	function setReady(value: boolean): void {
		ready = value;
	}

	const metrics = createMetrics(options.version, config.postgresPoolMax);

	const server = createProbeServer({
		client,
		applicationName,
		logger,
		metrics,
		metricsToken: config.metricsToken,
		// Every replica carries the spawner, so every replica publishes the queue
		// gauges — N scrapes each scanning the same table to report N copies of one
		// queue depth. The scan is served by `idx_tasks_active` and a dashboard
		// picks one target, so it is waste rather than a problem; there is no
		// longer a flag to make it conditional on.
		readTaskQueue: createTaskQueueReader(db),
		isReady: () => ready,
	});

	const shutdown = createShutdownController({
		logger,
		setReady,
		closeListener: () => close(server),
		closeDatabase: () => client.end(),
		flushSentry: async () => {
			await Sentry.flush(SENTRY_FLUSH_TIMEOUT);
		},
		timeout: config.shutdownTimeout,
	});

	shutdown.listen();

	try {
		await listen(server, config.probePort);
	} catch (err) {
		// The pool is open by now, and registering the signal handlers above has
		// already displaced Node's default exit behaviour — so a port that will not
		// bind would otherwise leave a container running forever with no listener
		// for the kubelet to fail, which is the one state Kubernetes cannot restart
		// its way out of. Release what was built before the failure propagates.
		await close(server);

		await client.end().catch((endErr) => {
			logger.error({ err: endErr }, "failed to close the database pool");
		});

		throw err;
	}

	logger.info(
		{ port: config.probePort, version: options.version },
		"listening",
	);

	return {
		config,
		logger,
		db,
		client,
		storage,
		metrics,
		onShutdown: shutdown.onShutdown,
		setReady,
	};
}
