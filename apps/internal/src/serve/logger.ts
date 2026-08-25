import * as Sentry from "@sentry/node";
import { createLogger, type Logger } from "@virtool/logger";
import { createSentryLogStream } from "@virtool/sentry/log";

/**
 * Build this process's logger.
 *
 * `name` is `jobs-api`, matching the Sentry `service` tag and the
 * `application_name` segment this process connects to Postgres under, so one
 * string identifies the service across logs, errors and pool metrics.
 *
 * With a DSN configured, records at `info` and above are fanned out to Sentry's
 * structured logging API alongside stdout; `debug` and `trace` stay local. The
 * DSN is passed in rather than read here because it has already been through
 * the `<KEY>_FILE` resolution in `config.ts`, which `readDsn` would skip. No
 * DSN means no stream at all, so dev and CI log to stdout only.
 */
export function createAppLogger(sentryDsn: string | undefined): Logger {
	return createLogger({
		name: "jobs-api",
		streams: sentryDsn
			? [
					{
						level: "info" as const,
						stream: createSentryLogStream(Sentry.logger),
					},
				]
			: undefined,
	});
}
