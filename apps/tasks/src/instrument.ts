import * as Sentry from "@sentry/node";
import { getCommonOptions } from "@virtool/sentry";

/** The name this service reports under, in Sentry and in `application_name`. */
export const SERVICE = "tasks";

/** What {@link initSentry} did, for the caller to log once it has a logger. */
export type SentryStatus = {
	enabled: boolean;
	environment: string;
};

/**
 * Initialise Sentry for this process.
 *
 * **This runs after `postgres` and the rest of the module graph have already
 * been imported, and that is fine only because the process is started with
 * `node --import @sentry/node/preload`.** ESM evaluates every static import
 * before any top-level statement, and the bundle makes that concrete — the
 * externals land at the top of `dist/index.mjs` while this call sits thousands
 * of lines below. Without the preload flag the SDK's module hooks would install
 * too late to patch anything, and the service would report errors while
 * silently recording no database spans.
 *
 * Init cannot simply move earlier: the DSN comes from `<KEY>_FILE`-backed
 * config, which has to be read first. That is exactly the case Sentry's "late
 * initialization" guidance covers, and the preload hook is its answer. If the
 * flag is ever dropped from the Dockerfile or the `start` script, tracing goes
 * quiet with nothing in the logs to say so.
 *
 * Reports to the same project as `apps/web` and `apps/jobs-api`, tagged
 * `service: tasks` and carrying its own `dist` so the images' source maps do
 * not collide under the shared release version. Both come from
 * `getCommonOptions`.
 *
 * The status is returned rather than logged. Nothing in this app builds a
 * logger at module scope, and `bootstrap` initialises Sentry *before* the
 * logger — both so that anything the logger's own construction reports is
 * already captured, and because `enabled` is what decides whether the logger
 * gets the `@virtool/sentry/log` destination that forwards `info`-and-above
 * records to Sentry. There is no logger to call at this point.
 */
export function initSentry(dsn: string | undefined): SentryStatus {
	const options = getCommonOptions(SERVICE);

	if (!dsn) {
		return { enabled: false, environment: options.environment };
	}

	Sentry.init({ ...options, dsn });

	return { enabled: true, environment: options.environment };
}
