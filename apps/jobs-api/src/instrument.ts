import * as Sentry from "@sentry/node";
import { getCommonOptions } from "@virtool/sentry";
import { logger } from "./logger";

/** The name this service reports under, in Sentry and in `application_name`. */
export const SERVICE = "jobs-api";

/**
 * Initialise Sentry for this process.
 *
 * **This runs after `@hono/node-server` and `postgres` have already been
 * imported, and that is fine only because the process is started with
 * `node --import @sentry/node/preload`.** ESM evaluates every static import
 * before any top-level statement, and the bundle makes that concrete — the
 * externals land at the top of `dist/index.mjs` while this call sits thousands
 * of lines below. Without the preload flag the SDK's module hooks would install
 * too late to patch either one, and the service would report errors while
 * silently recording no HTTP or database spans.
 *
 * Init cannot simply move earlier: the DSN comes from `<KEY>_FILE`-backed
 * config, which has to be read first. That is exactly the case Sentry's "late
 * initialization" guidance covers, and the preload hook is its answer. If the
 * flag is ever dropped from the Dockerfile or the `start` script, tracing goes
 * quiet with nothing in the logs to say so.
 *
 * Reports to the same project as `apps/web`, tagged `service: jobs-api` and
 * carrying its own `dist` so the two images' source maps do not collide under
 * the shared release version. Both come from `getCommonOptions`.
 *
 * `dsn` is passed in rather than read from the environment here, because the
 * value has already been through the `<KEY>_FILE` resolution in `config.ts` and
 * `readDsn` would go straight back to `process.env` and miss it. No DSN means
 * no `init`, so dev and unconfigured deploys are untouched.
 *
 * There is deliberately no `beforeSend` filter. The web app needs one because a
 * server function signals an expected 4xx by *throwing* `ClientError`, which
 * would otherwise be reported as an incident. This service has no such
 * mechanism: a Hono handler returns a 4xx response rather than throwing, so
 * nothing routine reaches Sentry in the first place. Add a filter here only if
 * a route starts throwing for an expected outcome — and prefer not to.
 */
export function initSentry(dsn: string | undefined): void {
	const options = getCommonOptions(SERVICE);

	if (!dsn) {
		logger.info(
			{ environment: options.environment, foundSentryDsn: false },
			"sentry disabled",
		);
		return;
	}

	Sentry.init({ ...options, dsn });

	logger.info(
		{ environment: options.environment, foundSentryDsn: true },
		"sentry initialised",
	);
}
