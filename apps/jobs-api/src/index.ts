import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { createDb, logPostgresVersion } from "@virtool/data/db/pg";
import { createEmitter } from "@virtool/data/events/emit";
import { createShutdownController } from "@virtool/service/shutdown";
import { createStorageBackend } from "@virtool/storage";
import { createApp } from "./app";
import { parseConfig } from "./config";
import { initSentry, SERVICE } from "./instrument";
import { createAppLogger } from "./logger";
import { createMetrics } from "./metrics/registry";

/** How long Sentry may spend flushing buffered envelopes, in milliseconds. */
const SENTRY_FLUSH_TIMEOUT = 2_000;

const config = parseConfig();

// Built first, and before `initSentry`, because everything below logs — and
// because the Sentry destination it attaches is decided by the same DSN.
const logger = createAppLogger(config.sentryDsn);

// Before the pool opens or the server listens, so Sentry's Node
// auto-instrumentation can install its import hooks ahead of what it patches.
initSentry(config.sentryDsn, logger);

const { client, db, applicationName } = createDb(config, SERVICE);

// Installs the process-wide client-event emitter. Every data function that
// mutates a row calls `emit`, which throws if nothing has been created — so
// without this the finalize and lifecycle routes answer 500 having already
// committed their work.
createEmitter({ client, logger });

let ready = true;

const app = createApp({
	client,
	db,
	storage: createStorageBackend(config.storage),
	logger,
	metrics: createMetrics(config.postgresPoolMax),
	applicationName,
	metricsToken: config.metricsToken,
	isReady: () => ready,
	captureException: Sentry.captureException,
});

logPostgresVersion(client, logger);

// `serve` is typed to return any of the servers it can build, http2 included.
// This service passes no `createServer`, so it is always an `http.Server` —
// which is also the only member of that union carrying
// `closeIdleConnections`.
const server = serve(
	{ fetch: app.fetch, hostname: config.host, port: config.port },
	() => {
		logger.info({ host: config.host, port: config.port }, "listening");
	},
) as Server;

const shutdown = createShutdownController({
	logger,
	setReady: (value) => {
		ready = value;
	},
	closeListener: () =>
		new Promise((resolve) => {
			server.close(() => resolve());
			// `close` stops the listener accepting connections but waits on the open
			// ones, and a workflow pod holds its socket open through undici's
			// dispatcher between requests. Without this the wait is bounded by the
			// keep-alive timeout of every idle runner rather than by the requests
			// actually in flight.
			server.closeIdleConnections();
		}),
	closeDatabase: () => client.end(),
	flushSentry: async () => {
		await Sentry.flush(SENTRY_FLUSH_TIMEOUT);
	},
	timeout: config.shutdownTimeout,
});

// No hooks are registered, deliberately. This service holds no work it has to
// hand back on the way out — a job is claimed by a workflow pod, not by this
// process — so readiness, the listener, the pool and Sentry are the whole
// sequence. The mechanism stays available for whatever does need it.
shutdown.listen();
